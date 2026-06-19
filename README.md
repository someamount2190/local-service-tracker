# Local Service Tracker

Live availability for local services — **bike docks, gyms, libraries, parking, and clinics** — in one place. It pulls a real public open-data feed, blends in additional sources, refreshes on a schedule, and degrades gracefully when an upstream source is slow, rate-limited, or down.

> **Stack:** Next.js 15 (App Router) · TypeScript · Postgres (Drizzle ORM) · scheduled refresh job · deploys to Vercel.

**🔗 Live demo: _add your Vercel URL here_ · [How it works](#architecture)**

---

## Why this project

It's deliberately built around a *messy real-world data source*. The hard parts aren't the UI — they're:

- **Rate limits / caching** — every source declares a minimum refresh interval; a TTL guard skips fetches that would hit upstream too soon, and page views trigger refreshes only when data is stale.
- **Stale & missing data** — readings carry both the source's own timestamp (`observedAt`) and our fetch time (`fetchedAt`). The gap drives a live/recent/stale/no-data freshness model surfaced in the UI. The synthetic source even simulates sensor dropouts.
- **When the source goes down** — a failed fetch never destroys existing data. The last-known readings keep serving, flagged stale, and a health banner explains the degradation. Every fetch attempt (success, skip, or failure) is logged to `fetch_runs` for observability.

## The real data source: GBFS

Bike-share dock availability ([GBFS](https://gbfs.org) — the open standard behind Citi Bike, Bay Wheels, etc.) is a clean stand-in for "parking / service availability": public, no API key, JSON, and genuinely messy — stations drop offline, `last_reported` lags, and `is_renting` flips. We map a dock's bike count to occupancy and use `last_reported` to detect staleness. Default feed is **NYC Citi Bike**; point `GBFS_BASE` at any other system.

Gyms, library seats, parking, and clinic waits rarely live in one public feed, so a **synthetic adapter** generates believable readings with realistic daily patterns. It's also the "always works" fallback that keeps the app fully demoable when GBFS is unreachable.

---

## Architecture

```
 Vercel Cron ──▶ /api/cron/refresh ──▶ refreshAll()
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 ▼                         ▼                        ▼
         GBFS adapter (real)      Synthetic adapter        [ add your own ]
                 │  normalize → { places[], readings[] }    implements DataSource
                 └────────────────────────┬────────────────────────┘
                                          ▼
                          Postgres (Drizzle)  places · readings · fetch_runs
                                          ▲
              page view ─▶ maybeRefresh() (TTL-guarded)
                                          │
                 getPlacesWithStatus() / getPlaceBySlug() / getHealth()
                                          ▼
                       Next.js App Router (server components)
```

| Layer | Files |
|---|---|
| **DB schema** (Drizzle, typed) | `src/db/schema.ts` |
| **Driver selection** (PGlite local / Neon prod) | `src/db/client.ts` |
| **Idempotent migration** | `src/db/migrate.ts` |
| **Source adapters** | `src/lib/sources/{gbfs,synthetic,registry}.ts` |
| **Resilient HTTP** (timeout, retry, backoff) | `src/lib/fetcher.ts` |
| **Refresh orchestrator** (upsert, TTL skip, source-down handling) | `src/lib/refresh.ts` |
| **Read model** (freshness, health) | `src/lib/status.ts` |
| **API routes** | `src/app/api/**` |
| **UI** | `src/app/**`, `src/components/**` |

### Database choice

Drizzle uses the **Postgres dialect everywhere**, with the driver chosen at runtime:

- **Local dev** → [PGlite](https://pglite.dev), an in-process WASM Postgres persisted to `./.pglite`. No install, no Docker — same SQL as production.
- **Production (Vercel)** → set `DATABASE_URL` to a [Neon](https://neon.tech) / Vercel Postgres connection string and the serverless HTTP driver kicks in automatically.

---

## Run it locally

Requires Node 18+. No database to install.

```bash
npm install
npm run db:setup     # create tables (idempotent)
npm run seed         # pull real GBFS + synthetic data, backfill 24h of history
npm run dev          # http://localhost:3000
```

> Run `db:setup` and `seed` with the dev server **stopped** — PGlite allows a single connection, so the dev server owns the DB while it's running.

To refresh data while the server is running, post to the cron endpoint:

```bash
npm run refresh:http   # POST http://localhost:3000/api/cron/refresh?force=1
```

Or just reload the page — each view triggers a TTL-guarded refresh automatically.

### API

| Endpoint | Description |
|---|---|
| `GET /api/places[?category=gym]` | All places with their latest status |
| `GET /api/places/[slug]` | One place + recent reading history |
| `GET /api/health` | Per-source health (200, or 503 if any source is down) |
| `GET\|POST /api/cron/refresh[?force=1]` | Trigger a refresh (Bearer `CRON_SECRET`) |

---

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Create a Postgres database (Vercel Postgres or Neon) and set **`DATABASE_URL`** in project env.
3. Set **`CRON_SECRET`** to a random string (Vercel Cron sends it as a Bearer token automatically).
4. Deploy. `vercel.json` registers a daily cron:

   ```json
   { "crons": [{ "path": "/api/cron/refresh", "schedule": "0 8 * * *" }] }
   ```

   > **Free-tier note:** Vercel's Hobby plan caps crons at **once per day** (a more frequent schedule fails the deploy). That's fine here — the real liveness mechanism is the **lazy, TTL-guarded refresh on page view** (`maybeRefresh()`), so the demo is current whenever someone opens it. On a Pro plan, bump the schedule to `*/2 * * * *` for always-warm data.

5. The schema self-initializes: `ensureSchema()` runs on every refresh/page request, so the first visit creates the tables and populates live data. To pre-seed 24h of synthetic history for richer charts on day one, run `db:setup` + `seed` locally with `DATABASE_URL` pointed at the production database.

### Environment variables

See [`.env.example`](./.env.example). All have sensible code defaults except `DATABASE_URL` (unset → PGlite) and `CRON_SECRET` (unset → refresh endpoint is unauthenticated, fine for local).

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Unset → PGlite locally. |
| `CRON_SECRET` | Bearer token guarding `/api/cron/refresh`. |
| `GBFS_BASE` | GBFS feed base URL (default NYC Citi Bike). |
| `GBFS_BBOX` | `minLng,minLat,maxLng,maxLat` to keep the dataset local. |
| `GBFS_LIMIT` | Max stations imported (default 80). |
| `REFRESH_TTL_SECONDS` | Freshness window + per-source min fetch interval. |

---

## Extending: add a source

Implement the `DataSource` interface (`src/lib/sources/types.ts`) — return normalized `places` and `readings`, declare a `minIntervalSeconds` — and register it in `src/lib/sources/registry.ts`. The orchestrator, freshness model, health checks, and UI pick it up automatically.

## Data model

- **`places`** — a tracked venue. Stable id `source:sourceId`; re-imports upsert.
- **`readings`** — time-series observations (`observedAt` vs `fetchedAt`, status, availability, occupancy, wait, `is_stale`).
- **`fetch_runs`** — one row per refresh attempt (ok / skipped-by-ttl / failed, counts, duration, http status, error) — the observability spine behind `/api/health`.
