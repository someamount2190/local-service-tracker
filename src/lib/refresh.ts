import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { places, readings, fetchRuns, type NewReading } from "@/db/schema";
import { SOURCES } from "./sources/registry";
import type { DataSource } from "./sources/types";

export interface SourceRunResult {
  source: string;
  ok: boolean;
  skipped?: string;
  placesUpserted: number;
  readingsInserted: number;
  durationMs: number;
  httpStatus?: number;
  error?: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Tiny deterministic hash → 6 base36 chars, to make slugs unique. */
function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

const idFor = (source: string, sourceId: string) => `${source}:${sourceId}`;

// In-process de-duplication: a second caller while a source is mid-refresh
// rides the same promise instead of stampeding the upstream / DB.
const inFlight = new Map<string, Promise<SourceRunResult>>();

async function lastSuccessAt(source: string): Promise<Date | null> {
  const db = await getDb();
  const rows = await db
    .select({ finishedAt: fetchRuns.finishedAt })
    .from(fetchRuns)
    .where(and(eq(fetchRuns.source, source), eq(fetchRuns.ok, true)))
    .orderBy(desc(fetchRuns.finishedAt))
    .limit(1);
  return rows[0]?.finishedAt ?? null;
}

async function runSource(source: DataSource, force: boolean): Promise<SourceRunResult> {
  const db = await getDb();
  const startedAt = new Date();

  // Respect the per-source minimum interval (rate-limit / TTL guard).
  if (!force) {
    const last = await lastSuccessAt(source.key);
    if (last && startedAt.getTime() - last.getTime() < source.minIntervalSeconds * 1000) {
      await db.insert(fetchRuns).values({
        source: source.key,
        startedAt,
        finishedAt: new Date(),
        ok: true,
        durationMs: 0,
        skippedReason: "ttl",
      });
      return {
        source: source.key,
        ok: true,
        skipped: "ttl",
        placesUpserted: 0,
        readingsInserted: 0,
        durationMs: 0,
      };
    }
  }

  try {
    const result = await source.fetch();
    const runAt = new Date();

    // Batched upsert — ONE statement, not N. Each query is a network round
    // trip on the serverless Neon HTTP driver, so a per-row loop (~80 stations)
    // could blow the serverless function timeout on the lazy-refresh path.
    const placeRows = result.places.map((p) => {
      const id = idFor(source.key, p.sourceId);
      return {
        id,
        source: source.key,
        sourceId: p.sourceId,
        slug: `${slugify(p.name)}-${shortHash(id)}`,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        capacity: p.capacity,
        address: p.address,
        url: p.url,
        metadata: p.metadata ?? {},
      };
    });
    if (placeRows.length) {
      await db
        .insert(places)
        .values(placeRows)
        .onConflictDoUpdate({
          target: places.id,
          set: {
            name: sql`excluded.name`,
            category: sql`excluded.category`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            capacity: sql`excluded.capacity`,
            address: sql`excluded.address`,
            url: sql`excluded.url`,
            metadata: sql`excluded.metadata`,
            updatedAt: runAt,
          },
        });
    }

    // Insert readings (all share this run's fetchedAt).
    const rows: NewReading[] = result.readings.map((r) => ({
      placeId: idFor(source.key, r.sourceId),
      observedAt: r.observedAt,
      fetchedAt: runAt,
      status: r.status,
      available: r.available ?? null,
      total: r.total ?? null,
      occupancyPct: r.occupancyPct ?? null,
      waitMinutes: r.waitMinutes ?? null,
      isStale: r.isStale,
      raw: r.raw ?? {},
    }));
    if (rows.length) await db.insert(readings).values(rows);

    const durationMs = Date.now() - startedAt.getTime();
    await db.insert(fetchRuns).values({
      source: source.key,
      startedAt,
      finishedAt: new Date(),
      ok: true,
      placesUpserted: result.places.length,
      readingsInserted: rows.length,
      durationMs,
      httpStatus: result.httpStatus,
    });

    return {
      source: source.key,
      ok: true,
      placesUpserted: result.places.length,
      readingsInserted: rows.length,
      durationMs,
      httpStatus: result.httpStatus,
    };
  } catch (err) {
    // Source is down / errored. We DO NOT touch existing data — the UI keeps
    // serving the last-known readings, flagged as stale.
    const durationMs = Date.now() - startedAt.getTime();
    const message = err instanceof Error ? err.message : String(err);
    const httpStatus =
      typeof (err as { httpStatus?: number })?.httpStatus === "number"
        ? (err as { httpStatus: number }).httpStatus
        : undefined;
    await db.insert(fetchRuns).values({
      source: source.key,
      startedAt,
      finishedAt: new Date(),
      ok: false,
      durationMs,
      httpStatus,
      error: message.slice(0, 500),
    });
    return { source: source.key, ok: false, placesUpserted: 0, readingsInserted: 0, durationMs, httpStatus, error: message };
  }
}

/** Refresh a single source (deduped while in flight). */
export function refreshSource(key: string, force = false): Promise<SourceRunResult> {
  const source = SOURCES.find((s) => s.key === key);
  if (!source) return Promise.reject(new Error(`unknown source: ${key}`));
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = (async () => {
    await ensureSchema();
    return runSource(source, force);
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Refresh every configured source. */
export async function refreshAll(force = false): Promise<SourceRunResult[]> {
  await ensureSchema();
  return Promise.all(SOURCES.map((s) => refreshSource(s.key, force)));
}

/**
 * Lazy refresh used by page views: if the freshest successful run across all
 * sources is older than the TTL, kick a refresh and await it (deduped). Returns
 * true if a refresh actually ran.
 */
export async function maybeRefresh(): Promise<boolean> {
  await ensureSchema();
  const ttlMs = Number(process.env.REFRESH_TTL_SECONDS ?? 90) * 1000;
  const db = await getDb();
  const rows = await db
    .select({ finishedAt: fetchRuns.finishedAt })
    .from(fetchRuns)
    .where(eq(fetchRuns.ok, true))
    .orderBy(desc(fetchRuns.finishedAt))
    .limit(1);
  const last = rows[0]?.finishedAt;
  if (last && Date.now() - last.getTime() < ttlMs) return false;
  await refreshAll(false);
  return true;
}
