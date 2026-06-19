import type {
  Category,
  DataSource,
  NormalizedPlace,
  NormalizedReading,
  PlaceStatus,
  SourceResult,
} from "./types";

/**
 * Synthetic adapter. Real open data rarely covers gyms, library seats, parking
 * and clinic waits in one feed, so we generate believable readings with diurnal
 * patterns. This also keeps the app fully demoable when the live GBFS source is
 * rate-limited or down — the "graceful degradation" half of the story.
 */

interface SyntheticPlace {
  sourceId: string;
  name: string;
  category: Exclude<Category, "bike_dock">;
  lat: number;
  lng: number;
  capacity: number; // for clinic, this is "patients in queue capacity"-ish
  address: string;
  openHour: number; // 24h local
  closeHour: number;
  url?: string;
}

export const SYNTHETIC_PLACES: SyntheticPlace[] = [
  { sourceId: "gym-chelsea", name: "Chelsea Iron Gym", category: "gym", lat: 40.7465, lng: -73.9974, capacity: 180, address: "210 W 18th St", openHour: 5, closeHour: 23 },
  { sourceId: "gym-soho", name: "SoHo Strength Club", category: "gym", lat: 40.7233, lng: -74.0009, capacity: 120, address: "55 Greene St", openHour: 6, closeHour: 22 },
  { sourceId: "gym-fidi", name: "FiDi Fitness Co.", category: "gym", lat: 40.7075, lng: -74.0113, capacity: 150, address: "80 Pine St", openHour: 5, closeHour: 23 },
  { sourceId: "lib-nypl-main", name: "NYPL — Stavros Niarchos", category: "library", lat: 40.7522, lng: -73.9819, capacity: 320, address: "455 5th Ave", openHour: 9, closeHour: 21 },
  { sourceId: "lib-jeff-market", name: "Jefferson Market Library", category: "library", lat: 40.7345, lng: -73.9999, capacity: 90, address: "425 6th Ave", openHour: 10, closeHour: 20 },
  { sourceId: "lib-mulberry", name: "Mulberry Street Library", category: "library", lat: 40.7252, lng: -73.9956, capacity: 110, address: "10 Jersey St", openHour: 10, closeHour: 21 },
  { sourceId: "park-spring", name: "SpringPark Garage", category: "parking", lat: 40.7223, lng: -74.0021, capacity: 240, address: "100 Spring St", openHour: 0, closeHour: 24 },
  { sourceId: "park-w20", name: "West 20th Parking", category: "parking", lat: 40.7438, lng: -74.0019, capacity: 160, address: "150 W 20th St", openHour: 0, closeHour: 24 },
  { sourceId: "clinic-village", name: "Village Urgent Care", category: "clinic", lat: 40.7335, lng: -74.0027, capacity: 30, address: "65 Christopher St", openHour: 8, closeHour: 20 },
  { sourceId: "clinic-midtown", name: "Midtown Walk-In Clinic", category: "clinic", lat: 40.7505, lng: -73.9886, capacity: 40, address: "320 W 37th St", openHour: 8, closeHour: 22 },
];

function isOpen(p: SyntheticPlace, hour: number): boolean {
  if (p.closeHour >= 24) return true; // 24h
  return hour >= p.openHour && hour < p.closeHour;
}

/** Smooth 0..1 "busyness" with category-appropriate daily shape. */
function busyness(category: Category, date: Date): number {
  const h = date.getHours() + date.getMinutes() / 60;
  const bump = (center: number, width: number) =>
    Math.exp(-((h - center) ** 2) / (2 * width ** 2));
  switch (category) {
    case "gym":
      return Math.min(1, 0.15 + 0.85 * Math.max(bump(7.5, 1.4), bump(18, 2)));
    case "library":
      return Math.min(1, 0.1 + 0.8 * bump(14, 3.5));
    case "parking":
      return Math.min(1, 0.2 + 0.7 * bump(13, 4));
    case "clinic":
      return Math.min(1, 0.2 + 0.7 * Math.max(bump(10, 2), bump(18, 2.5)));
    default:
      return 0.5;
  }
}

/**
 * Build one reading for a place at a given time. `live` injects small noise and
 * a ~3% "sensor dropout" so the stale/missing-data UI paths get exercised; the
 * historical backfill uses live=false for clean charts.
 */
export function generateReading(
  p: SyntheticPlace,
  date: Date,
  live = true,
): NormalizedReading {
  const open = isOpen(p, date.getHours());

  if (live && open && Math.random() < 0.03) {
    // Simulated dropout: source reachable but this place reported nothing usable.
    return {
      sourceId: p.sourceId,
      observedAt: date,
      status: "unknown",
      isStale: true,
      raw: { dropout: true },
    };
  }

  if (!open) {
    const status: PlaceStatus = "closed";
    if (p.category === "clinic") {
      return { sourceId: p.sourceId, observedAt: date, status, waitMinutes: 0, isStale: false, raw: {} };
    }
    return {
      sourceId: p.sourceId,
      observedAt: date,
      status,
      available: p.category === "parking" ? p.capacity : 0,
      total: p.capacity,
      occupancyPct: 0,
      isStale: false,
      raw: {},
    };
  }

  const noise = live ? (Math.random() - 0.5) * 0.12 : 0;
  const occ = Math.max(0, Math.min(1, busyness(p.category, date) + noise));

  if (p.category === "clinic") {
    // Wait scales with busyness; ~0..55 minutes.
    const wait = Math.round(occ * 55);
    return {
      sourceId: p.sourceId,
      observedAt: date,
      status: "open",
      waitMinutes: wait,
      occupancyPct: occ,
      isStale: false,
      raw: { queueLength: Math.round(occ * p.capacity) },
    };
  }

  const inUse = Math.round(occ * p.capacity);
  const available = p.capacity - inUse;
  return {
    sourceId: p.sourceId,
    observedAt: date,
    status: "open",
    available,
    total: p.capacity,
    occupancyPct: occ,
    isStale: false,
    raw: {},
  };
}

function toNormalizedPlace(p: SyntheticPlace): NormalizedPlace {
  return {
    sourceId: p.sourceId,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    capacity: p.capacity,
    address: p.address,
    url: p.url,
    metadata: { openHour: p.openHour, closeHour: p.closeHour },
  };
}

export const syntheticSource: DataSource = {
  key: "synthetic",
  label: "Gyms, libraries, parking & clinics (synthetic)",
  minIntervalSeconds: 30,

  async fetch(): Promise<SourceResult> {
    const now = new Date();
    return {
      places: SYNTHETIC_PLACES.map(toNormalizedPlace),
      readings: SYNTHETIC_PLACES.map((p) => generateReading(p, now, true)),
    };
  },
};
