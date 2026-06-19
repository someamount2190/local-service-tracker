/**
 * Manual refresh trigger.
 *
 *   npm run refresh:http   → POST the running dev server's /api/cron/refresh
 *                            (use this while `npm run dev` is running; PGlite
 *                            allows only one connection, so the server owns it).
 *   npm run refresh        → refresh directly against the DB (server stopped).
 *
 * Pass --force to bypass the per-source TTL guard (default for both modes).
 */
const useHttp = process.argv.includes("--http");
const force = !process.argv.includes("--no-force");

async function viaHttp() {
  const base = process.env.REFRESH_TARGET_URL ?? "http://localhost:3000";
  const url = `${base}/api/cron/refresh${force ? "?force=1" : ""}`;
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  const res = await fetch(url, { method: "POST", headers });
  const body = await res.json();
  console.log(`HTTP ${res.status}`, JSON.stringify(body, null, 2));
  if (!res.ok) process.exit(1);
}

async function direct() {
  const { refreshAll } = await import("../src/lib/refresh");
  const results = await refreshAll(force);
  for (const r of results) {
    console.log(
      `${r.ok ? "✓" : "✗"} ${r.source}: ${r.skipped ? `skipped (${r.skipped})` : `${r.placesUpserted} places, ${r.readingsInserted} readings, ${r.durationMs}ms`}` +
        (r.error ? ` — ${r.error}` : ""),
    );
  }
}

(useHttp ? viaHttp() : direct())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ refresh failed:", err);
    process.exit(1);
  });
