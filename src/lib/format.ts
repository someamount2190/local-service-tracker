import type { Category } from "./sources/types";
import type { Freshness } from "./status";
import type { Reading } from "@/db/schema";

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "bike_dock", label: "Bike docks", icon: "🚲" },
  { key: "gym", label: "Gyms", icon: "🏋️" },
  { key: "library", label: "Libraries", icon: "📚" },
  { key: "parking", label: "Parking", icon: "🅿️" },
  { key: "clinic", label: "Clinics", icon: "🏥" },
];

export function categoryMeta(category: string) {
  return CATEGORIES.find((c) => c.key === category) ?? { key: category, label: category, icon: "📍" };
}

/** Human label for the primary "available" metric, per category. */
export function availabilityLabel(category: string): string {
  switch (category) {
    case "bike_dock":
      return "bikes available";
    case "gym":
      return "spots free";
    case "library":
      return "seats free";
    case "parking":
      return "spaces free";
    default:
      return "available";
  }
}

export function freshnessMeta(freshness: Freshness): { label: string; tone: string } {
  switch (freshness) {
    case "live":
      return { label: "Live", tone: "emerald" };
    case "recent":
      return { label: "Recent", tone: "sky" };
    case "stale":
      return { label: "Stale", tone: "amber" };
    case "no-data":
      return { label: "No data", tone: "zinc" };
  }
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Tailwind color stem for an occupancy fraction (0..1, share in use). */
export function occupancyTone(pct: number | null): string {
  if (pct == null) return "zinc";
  if (pct < 0.5) return "emerald";
  if (pct < 0.8) return "amber";
  return "rose";
}

/** The headline number + unit for a card, derived per category. */
export function headline(category: string, r: Reading | null): { value: string; unit: string } {
  if (!r || r.status === "unknown") return { value: "—", unit: "no reading" };
  if (category === "clinic") {
    if (r.status === "closed") return { value: "Closed", unit: "" };
    return { value: r.waitMinutes != null ? `${r.waitMinutes}` : "—", unit: "min wait" };
  }
  if (r.status === "closed") return { value: "Closed", unit: "" };
  return { value: r.available != null ? `${r.available}` : "—", unit: availabilityLabel(category) };
}
