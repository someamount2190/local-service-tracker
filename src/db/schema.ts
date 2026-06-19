import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  serial,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * A physical place whose availability we track. The id is a stable composite
 * of `${source}:${sourceId}` so re-importing the same upstream record updates
 * the existing row instead of duplicating it.
 */
export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(), // adapter key, e.g. "gbfs" | "synthetic"
    sourceId: text("source_id").notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(), // bike_dock | gym | library | parking | clinic
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    capacity: integer("capacity"),
    address: text("address"),
    url: text("url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySource: index("places_source_idx").on(t.source),
    byCategory: index("places_category_idx").on(t.category),
  }),
);

/**
 * A time-series observation for a place. `observedAt` is the upstream source's
 * own timestamp; `fetchedAt` is when *we* pulled it. The gap between the two is
 * how we reason about staleness.
 */
export const readings = pgTable(
  "readings",
  {
    id: serial("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull(), // open | closed | unknown
    available: integer("available"), // free units: bikes, seats, spots
    total: integer("total"), // capacity snapshot
    occupancyPct: doublePrecision("occupancy_pct"), // 0..1 share *in use*
    waitMinutes: integer("wait_minutes"),
    isStale: boolean("is_stale").notNull().default(false),
    raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
  },
  (t) => ({
    byPlaceTime: index("readings_place_fetched_idx").on(t.placeId, t.fetchedAt),
  }),
);

/**
 * One row per attempted refresh of a source. This is the observability spine:
 * it records skips (rate limit / ttl), upstream failures (source down), and
 * how much data each run produced. The UI's health banner reads from here.
 */
export const fetchRuns = pgTable("fetch_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok").notNull().default(false),
  placesUpserted: integer("places_upserted").notNull().default(0),
  readingsInserted: integer("readings_inserted").notNull().default(0),
  durationMs: integer("duration_ms"),
  httpStatus: integer("http_status"),
  skippedReason: text("skipped_reason"), // null = actually ran
  error: text("error"),
});

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;
export type FetchRun = typeof fetchRuns.$inferSelect;
