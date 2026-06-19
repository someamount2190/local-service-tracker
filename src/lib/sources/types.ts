export type Category = "bike_dock" | "gym" | "library" | "parking" | "clinic";

export type PlaceStatus = "open" | "closed" | "unknown";

/** A place as produced by an adapter, before it is persisted. */
export interface NormalizedPlace {
  sourceId: string;
  name: string;
  category: Category;
  lat?: number;
  lng?: number;
  capacity?: number;
  address?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/** A single observation tied to a place's sourceId. */
export interface NormalizedReading {
  sourceId: string;
  observedAt: Date; // upstream timestamp
  status: PlaceStatus;
  available?: number; // free units (bikes, seats, spots)
  total?: number; // capacity at observation time
  occupancyPct?: number; // 0..1, share *in use*
  waitMinutes?: number;
  isStale: boolean; // upstream record is older than its own freshness window
  raw?: Record<string, unknown>;
}

export interface SourceResult {
  places: NormalizedPlace[];
  readings: NormalizedReading[];
  /** Upstream HTTP status if the adapter made a network call. */
  httpStatus?: number;
}

export interface DataSource {
  /** Stable adapter key, also stored on each place row. */
  key: string;
  label: string;
  /**
   * Minimum seconds between real fetches. Used to respect upstream rate limits
   * / cache TTLs. The orchestrator skips a run if the last success is newer.
   */
  minIntervalSeconds: number;
  fetch(): Promise<SourceResult>;
}
