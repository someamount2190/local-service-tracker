import { and, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { places, readings, fetchRuns, type Place, type Reading } from "@/db/schema";

export type Freshness = "live" | "recent" | "stale" | "no-data";

export interface PlaceStatusView {
  place: Place;
  reading: Reading | null;
  freshness: Freshness;
  ageSeconds: number | null;
}

const LIVE_MAX_SECONDS = 5 * 60;
const RECENT_MAX_SECONDS = 30 * 60;

export function computeFreshness(
  observedAt: Date | null,
  isStale: boolean,
): { freshness: Freshness; ageSeconds: number | null } {
  if (!observedAt) return { freshness: "no-data", ageSeconds: null };
  const ageSeconds = Math.max(0, Math.round((Date.now() - observedAt.getTime()) / 1000));
  if (isStale || ageSeconds >= RECENT_MAX_SECONDS) return { freshness: "stale", ageSeconds };
  if (ageSeconds < LIVE_MAX_SECONDS) return { freshness: "live", ageSeconds };
  return { freshness: "recent", ageSeconds };
}

/** Latest reading per place, joined to the place row. */
export async function getPlacesWithStatus(category?: string): Promise<PlaceStatusView[]> {
  await ensureSchema();
  const db = await getDb();

  const latest = db
    .select({ placeId: readings.placeId, maxFetched: max(readings.fetchedAt).as("max_fetched") })
    .from(readings)
    .groupBy(readings.placeId)
    .as("latest");

  const latestReadings = await db
    .select({ reading: readings })
    .from(readings)
    .innerJoin(
      latest,
      and(eq(readings.placeId, latest.placeId), eq(readings.fetchedAt, latest.maxFetched)),
    );

  const byPlace = new Map<string, Reading>();
  for (const row of latestReadings) byPlace.set(row.reading.placeId, row.reading);

  const placeRows = category
    ? await db.select().from(places).where(eq(places.category, category))
    : await db.select().from(places);

  const views = placeRows.map((place) => {
    const reading = byPlace.get(place.id) ?? null;
    const { freshness, ageSeconds } = computeFreshness(
      reading?.observedAt ?? null,
      reading?.isStale ?? false,
    );
    return { place, reading, freshness, ageSeconds } satisfies PlaceStatusView;
  });

  // Sort: open & live first, then by name.
  const rank = (v: PlaceStatusView) =>
    (v.reading?.status === "open" ? 0 : v.reading?.status === "closed" ? 2 : 3) +
    (v.freshness === "stale" || v.freshness === "no-data" ? 0.5 : 0);
  return views.sort((a, b) => rank(a) - rank(b) || a.place.name.localeCompare(b.place.name));
}

export async function getPlaceBySlug(
  slug: string,
  historyLimit = 96,
): Promise<{ view: PlaceStatusView; history: Reading[] } | null> {
  await ensureSchema();
  const db = await getDb();
  const placeRows = await db.select().from(places).where(eq(places.slug, slug)).limit(1);
  const place = placeRows[0];
  if (!place) return null;

  const history = await db
    .select()
    .from(readings)
    .where(eq(readings.placeId, place.id))
    .orderBy(desc(readings.fetchedAt))
    .limit(historyLimit);

  const reading = history[0] ?? null;
  const { freshness, ageSeconds } = computeFreshness(
    reading?.observedAt ?? null,
    reading?.isStale ?? false,
  );
  return { view: { place, reading, freshness, ageSeconds }, history };
}

export interface SourceHealth {
  source: string;
  state: "ok" | "degraded" | "down" | "idle";
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  lastHttpStatus: number | null;
}

export async function getHealth(): Promise<{
  overall: "ok" | "degraded" | "down";
  sources: SourceHealth[];
}> {
  await ensureSchema();
  const db = await getDb();
  const allRuns = await db
    .select()
    .from(fetchRuns)
    .orderBy(desc(fetchRuns.startedAt))
    .limit(200);

  const keys = Array.from(new Set(allRuns.map((r) => r.source)));
  const sources: SourceHealth[] = keys.map((key) => {
    const runs = allRuns.filter((r) => r.source === key);
    const lastRun = runs.find((r) => !r.skippedReason) ?? runs[0] ?? null;
    const lastSuccess = runs.find((r) => r.ok && !r.skippedReason) ?? null;
    const lastFail = runs.find((r) => !r.ok);

    let state: SourceHealth["state"] = "idle";
    if (lastSuccess) {
      const fresh =
        Date.now() - (lastSuccess.finishedAt ?? lastSuccess.startedAt).getTime() <
        RECENT_MAX_SECONDS * 1000;
      // Degraded if the most recent real run failed even though we have history.
      state = lastRun && !lastRun.ok ? "degraded" : fresh ? "ok" : "degraded";
    } else if (lastFail) {
      state = "down";
    }

    return {
      source: key,
      state,
      lastRunAt: lastRun?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastError: lastFail?.error ?? null,
      lastHttpStatus: lastRun?.httpStatus ?? null,
    } satisfies SourceHealth;
  });

  const overall: "ok" | "degraded" | "down" = sources.some((s) => s.state === "down")
    ? "down"
    : sources.some((s) => s.state === "degraded" || s.state === "idle")
      ? "degraded"
      : "ok";

  return { overall, sources };
}
