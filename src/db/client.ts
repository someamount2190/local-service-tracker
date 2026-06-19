import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB =
  | PgliteDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/**
 * Driver selection:
 *   - Production (Vercel): DATABASE_URL points at Neon / Vercel Postgres → use
 *     the serverless HTTP driver, which works in serverless/edge runtimes.
 *   - Local dev: no DATABASE_URL → fall back to PGlite, an in-process WASM
 *     Postgres persisted to ./.pglite. Same SQL dialect, zero install.
 * Override with LST_DB="neon" | "pglite".
 */
export function selectedDriver(): "neon" | "pglite" {
  const forced = process.env.LST_DB?.toLowerCase();
  if (forced === "neon" || forced === "pglite") return forced;
  const url = process.env.DATABASE_URL;
  return url && /^postgres(ql)?:\/\//.test(url) ? "neon" : "pglite";
}

// Cache the instance on globalThis so Next.js hot-reload (and multiple route
// handlers in one process) reuse a single PGlite connection.
const globalForDb = globalThis as unknown as { __lstDb?: Promise<DB> };

async function init(): Promise<DB> {
  if (selectedDriver() === "neon") {
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL as string);
    return drizzle(sql, { schema });
  }

  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || ".pglite";
  const client = new PGlite(dir);
  await client.waitReady;
  return drizzle(client, { schema });
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__lstDb) {
    globalForDb.__lstDb = init();
  }
  return globalForDb.__lstDb;
}
