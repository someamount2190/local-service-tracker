/**
 * Seed script. Run with the dev server STOPPED (PGlite allows one connection).
 *   1. ensure schema
 *   2. refreshAll() — creates all places + one live reading each (real GBFS +
 *      synthetic). GBFS may fail if offline; synthetic always succeeds.
 *   3. backfill ~24h of hourly synthetic readings so detail charts look real
 *      on first load.
 */
import { getDb } from "../src/db/client";
import { ensureSchema } from "../src/db/migrate";
import { places, readings, type NewReading } from "../src/db/schema";
import { refreshAll } from "../src/lib/refresh";
import { SYNTHETIC_PLACES, generateReading } from "../src/lib/sources/synthetic";

async function main() {
  await ensureSchema();

  console.log("→ initial refresh (real + synthetic)…");
  const results = await refreshAll(true);
  for (const r of results) {
    console.log(
      `   ${r.ok ? "✓" : "✗"} ${r.source}: ${r.placesUpserted} places, ${r.readingsInserted} readings` +
        (r.error ? ` (error: ${r.error})` : ""),
    );
  }

  console.log("→ backfilling 24h of synthetic history…");
  const db = await getDb();
  const now = Date.now();
  const rows: NewReading[] = [];
  for (const p of SYNTHETIC_PLACES) {
    const placeId = `synthetic:${p.sourceId}`;
    for (let hoursAgo = 24; hoursAgo >= 1; hoursAgo--) {
      const ts = new Date(now - hoursAgo * 3600_000);
      const r = generateReading(p, ts, false);
      rows.push({
        placeId,
        observedAt: ts,
        fetchedAt: ts,
        status: r.status,
        available: r.available ?? null,
        total: r.total ?? null,
        occupancyPct: r.occupancyPct ?? null,
        waitMinutes: r.waitMinutes ?? null,
        isStale: r.isStale,
        raw: r.raw ?? {},
      });
    }
  }
  // Insert in chunks to keep statements small.
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(readings).values(rows.slice(i, i + 100));
  }
  console.log(`   ✓ inserted ${rows.length} historical readings`);

  const allPlaces = await db.select({ id: places.id }).from(places);
  console.log(`✓ seed complete — ${allPlaces.length} places tracked`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
