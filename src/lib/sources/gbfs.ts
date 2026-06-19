import { fetchJson } from "../fetcher";
import type { DataSource, NormalizedPlace, NormalizedReading, SourceResult } from "./types";

/**
 * Real open-data adapter: GBFS (General Bikeshare Feed Specification).
 *
 * Bike-share dock availability is a clean real-world stand-in for "parking /
 * service availability": public, no API key, JSON, and genuinely messy —
 * stations drop offline, `last_reported` lags, and `is_renting` flips. We treat
 * a dock's bike count as occupancy and use `last_reported` to detect stale rows.
 *
 * Default feed: NYC Citi Bike. Configurable via GBFS_BASE.
 */

interface StationInfo {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity?: number;
  rental_uris?: { ios?: string; android?: string };
}

interface StationStatus {
  station_id: string;
  num_bikes_available: number;
  num_ebikes_available?: number;
  num_docks_available: number;
  is_installed: number | boolean;
  is_renting: number | boolean;
  last_reported: number; // unix seconds
}

const STALE_AFTER_SECONDS = 300; // an upstream row older than 5 min is "stale"

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseBbox(): [number, number, number, number] | null {
  const raw = process.env.GBFS_BBOX;
  if (!raw) return null;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return parts as [number, number, number, number];
}

export const gbfsSource: DataSource = {
  key: "gbfs",
  label: "Bike-share docks (GBFS)",
  minIntervalSeconds: Number(process.env.REFRESH_TTL_SECONDS ?? 90),

  async fetch(): Promise<SourceResult> {
    const base = (process.env.GBFS_BASE ?? "https://gbfs.citibikenyc.com/gbfs/en").replace(/\/$/, "");
    const limit = Number(process.env.GBFS_LIMIT ?? 80);
    const bbox = parseBbox();

    const [infoRes, statusRes] = await Promise.all([
      fetchJson<{ data: { stations: StationInfo[] } }>(`${base}/station_information.json`),
      fetchJson<{ data: { stations: StationStatus[] }; last_updated: number }>(
        `${base}/station_status.json`,
      ),
    ]);

    const info = new Map(infoRes.data.data.stations.map((s) => [s.station_id, s]));
    const nowSec = Math.floor(statusRes.data.last_updated || Date.now() / 1000);

    const places: NormalizedPlace[] = [];
    const readings: NormalizedReading[] = [];

    // Stable ordering so the demo dataset is deterministic across runs.
    const stations = [...statusRes.data.data.stations].sort((a, b) =>
      a.station_id.localeCompare(b.station_id),
    );

    for (const st of stations) {
      if (places.length >= limit) break;
      const meta = info.get(st.station_id);
      if (!meta || meta.lat == null || meta.lon == null) continue;
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        if (meta.lon < minLng || meta.lon > maxLng || meta.lat < minLat || meta.lat > maxLat) {
          continue;
        }
      }

      const capacity =
        meta.capacity ?? ((st.num_bikes_available + st.num_docks_available) || undefined);
      const open = Boolean(Number(st.is_installed)) && Boolean(Number(st.is_renting));
      const stale = nowSec - st.last_reported > STALE_AFTER_SECONDS;
      const bikes = st.num_bikes_available ?? 0;

      places.push({
        sourceId: st.station_id,
        name: meta.name,
        category: "bike_dock",
        lat: meta.lat,
        lng: meta.lon,
        capacity,
        url: meta.rental_uris?.ios ?? meta.rental_uris?.android,
        metadata: { legacyId: st.station_id },
      });

      readings.push({
        sourceId: st.station_id,
        observedAt: new Date(st.last_reported * 1000),
        status: open ? "open" : "closed",
        available: bikes, // bikes available to rent
        total: capacity,
        occupancyPct: capacity ? clamp01(bikes / capacity) : undefined,
        isStale: stale,
        raw: {
          bikesAvailable: bikes,
          ebikesAvailable: st.num_ebikes_available ?? 0,
          docksAvailable: st.num_docks_available,
          isInstalled: Boolean(Number(st.is_installed)),
          isRenting: Boolean(Number(st.is_renting)),
        },
      });
    }

    return { places, readings, httpStatus: statusRes.httpStatus };
  },
};
