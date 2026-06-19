# Portfolio kit — Local Service Tracker

Copy-paste blurbs, talking points, and a screenshot shot-list for showcasing this project. Swap in your live URL + repo link where marked.

---

## One-liner (resume / project card)

> **Local Service Tracker** — a full-stack Next.js app showing live availability for local services (bike docks, gyms, libraries, parking, clinics), built on a real open-data feed with graceful handling of stale data, rate limits, and source outages.

## Short blurb (portfolio card, ~40 words)

> A live availability dashboard for city services. Pulls a real public bike-share feed (GBFS) plus other sources on a schedule, normalizes them through a pluggable adapter layer, and stays useful even when an upstream source is rate-limited or down. Next.js 15 · TypeScript · Postgres · Vercel.

## Longer description (project page)

> Local Service Tracker answers a simple question — *"is there space / a bike / a short wait right now?"* — across different kinds of city services in one view. The interesting engineering isn't the UI; it's everything around a messy real-world data source: respecting upstream rate limits, caching with a TTL so we don't hammer the source, distinguishing the source's own timestamp from our fetch time to reason about staleness, and never going blank when a feed fails — the last-known data keeps serving, clearly flagged, while a health panel explains the degradation.
>
> A pluggable adapter layer normalizes every source into the same shape, so adding a new one is a single file. The database uses the Postgres dialect everywhere via Drizzle, with a runtime driver switch: an in-process WASM Postgres for zero-install local dev, and serverless Postgres in production.

---

## Tech stack

- **Frontend / framework:** Next.js 15 (App Router, React Server Components), TypeScript, Tailwind CSS v4
- **Database:** Postgres via Drizzle ORM — PGlite (in-process WASM) locally, Neon serverless in production
- **Scheduled jobs:** Vercel Cron → authenticated refresh endpoint
- **Data source:** live GBFS bike-share feed (no API key) + a synthetic generator for other categories
- **Deploy:** Vercel

---

## Interview talking points

Lead with the prompt's hooks — *rate limits, caching, and what happens when the source goes down.* Each is a real mechanism in the code, not a buzzword.

**1. Rate limits & caching (TTL guard)**
- Every source declares a `minIntervalSeconds`. Before fetching, the orchestrator checks the last successful run in the DB; if it's within the window, it **skips** and logs `skipped: "ttl"` instead of hitting the upstream.
- Page views call a `maybeRefresh()` that only triggers a fetch when data is older than the TTL — so traffic doesn't translate into upstream load.
- In-process de-duplication: concurrent requests that arrive mid-refresh ride the same in-flight promise instead of stampeding the source.
- *File:* `src/lib/refresh.ts`

**2. What happens when the source goes down**
- A failed fetch is caught, logged to a `fetch_runs` table (with HTTP status + error), and **existing data is never touched** — the UI keeps serving the last-known readings, flagged stale, and a health banner explains the degradation. `/api/health` returns 503 if a source is fully down.
- The HTTP client has bounded timeouts and retries with exponential backoff + jitter, so transient blips self-heal before they ever count as "down."
- I demoed this by pointing the feed at a dead host: all 80 places kept rendering, health flipped to `degraded`, and the synthetic source stayed green.
- *Files:* `src/lib/fetcher.ts`, `src/lib/refresh.ts`, `src/lib/status.ts`

**3. Stale vs. missing data**
- Each reading stores both `observedAt` (the source's own timestamp) and `fetchedAt` (when we pulled it). The gap drives a four-state freshness model — *live / recent / stale / no-data* — surfaced as badges. GBFS's `last_reported` flags rows the source itself hasn't updated; the synthetic source even simulates sensor dropouts so the missing-data path is exercised.

**4. A serverless-timeout bug I caught before it shipped**
- The first version upserted places one row at a time. Locally (in-process DB) that's instant — but on the serverless Postgres HTTP driver each query is a network round trip, so ~80 stations would risk the 10s function limit on the first page load. I refactored to a **single batched upsert** (`INSERT ... ON CONFLICT DO UPDATE` over all rows using `excluded.*`), cutting ~80 round trips to one.

**5. Pragmatic database design**
- Drizzle keeps the **Postgres dialect identical** across environments; the driver is selected at runtime by the presence of `DATABASE_URL`. Local dev needs no Docker or Postgres install (PGlite is in-process WASM), and production is real serverless Postgres — same schema, same queries, same migration SQL.

**6. Honest scope / trade-offs (good to volunteer)**
- Real open data rarely covers gyms/clinics in one feed, so those categories are synthetic — explicitly labeled in the UI and README. The architecture treats real and synthetic sources identically, so swapping a synthetic category for a real API is a one-file change.

---

## Screenshot shot-list (for the README + portfolio)

Capture these from the live site (or `npm run dev`) and drop them in a `/docs/screenshots` folder, then embed in the README:

1. **Home grid** — the status cards with freshness badges + occupancy bars (the money shot).
2. **A category filter applied** (e.g. Bike docks) showing the live count.
3. **A place detail page** with the occupancy/wait sparkline.
4. **The degraded health banner** — reproduce by running `GBFS_BASE=https://bad.invalid/gbfs/en npm run refresh -- --force`, then reload. Shows the "serving last-known data" story visually.

> Tip: a short screen-recording GIF of the home page auto-refreshing + opening a detail page is worth more than any single screenshot.

---

## Links

- **Live demo:** _add Vercel URL_
- **Source:** _add GitHub URL_
