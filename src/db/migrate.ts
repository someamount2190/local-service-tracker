import { sql } from "drizzle-orm";
import { getDb } from "./client";

/**
 * Idempotent schema setup. We use plain `CREATE TABLE IF NOT EXISTS` DDL rather
 * than a migration journal so the same code path works on both PGlite (local)
 * and Neon (prod) without running drizzle-kit at deploy time. The statements
 * mirror src/db/schema.ts exactly.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS places (
     id            text PRIMARY KEY,
     source        text NOT NULL,
     source_id     text NOT NULL,
     slug          text NOT NULL UNIQUE,
     name          text NOT NULL,
     category      text NOT NULL,
     lat           double precision,
     lng           double precision,
     capacity      integer,
     address       text,
     url           text,
     metadata      jsonb DEFAULT '{}'::jsonb,
     created_at    timestamptz NOT NULL DEFAULT now(),
     updated_at    timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS places_source_idx ON places (source)`,
  `CREATE INDEX IF NOT EXISTS places_category_idx ON places (category)`,

  `CREATE TABLE IF NOT EXISTS readings (
     id            serial PRIMARY KEY,
     place_id      text NOT NULL REFERENCES places(id) ON DELETE CASCADE,
     observed_at   timestamptz NOT NULL,
     fetched_at    timestamptz NOT NULL DEFAULT now(),
     status        text NOT NULL,
     available     integer,
     total         integer,
     occupancy_pct double precision,
     wait_minutes  integer,
     is_stale      boolean NOT NULL DEFAULT false,
     raw           jsonb DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS readings_place_fetched_idx ON readings (place_id, fetched_at)`,

  `CREATE TABLE IF NOT EXISTS fetch_runs (
     id               serial PRIMARY KEY,
     source           text NOT NULL,
     started_at       timestamptz NOT NULL DEFAULT now(),
     finished_at      timestamptz,
     ok               boolean NOT NULL DEFAULT false,
     places_upserted  integer NOT NULL DEFAULT 0,
     readings_inserted integer NOT NULL DEFAULT 0,
     duration_ms      integer,
     http_status      integer,
     skipped_reason   text,
     error            text
   )`,
];

export async function ensureSchema(): Promise<void> {
  const db = await getDb();
  for (const stmt of STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}

// Allow `npm run db:setup` to run this directly. Guard on the entry script
// (argv[1]) so importing this module elsewhere doesn't trigger a run + exit.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/migrate.ts")) {
  ensureSchema()
    .then(() => {
      console.log("✓ schema ready");
      process.exit(0);
    })
    .catch((err) => {
      console.error("✗ schema setup failed:", err);
      process.exit(1);
    });
}
