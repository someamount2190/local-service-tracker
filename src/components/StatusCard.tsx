import Link from "next/link";
import { categoryMeta, headline, timeAgo } from "@/lib/format";
import type { PlaceStatusView } from "@/lib/status";
import { FreshnessBadge } from "./FreshnessBadge";
import { OccupancyBar } from "./OccupancyBar";

export function StatusCard({ view }: { view: PlaceStatusView }) {
  const { place, reading, freshness } = view;
  const cat = categoryMeta(place.category);
  const h = headline(place.category, reading);
  const closed = reading?.status === "closed";
  const dimmed = closed || freshness === "no-data";

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </div>
          <h3 className="mt-0.5 truncate font-medium text-zinc-100 group-hover:text-white">
            {place.name}
          </h3>
        </div>
        <FreshnessBadge freshness={freshness} />
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className={`text-3xl font-semibold tabular-nums ${dimmed ? "text-zinc-500" : "text-zinc-50"}`}>
          {h.value}
        </span>
        {h.unit && <span className="text-xs text-zinc-400">{h.unit}</span>}
      </div>

      {place.category !== "clinic" && reading?.occupancyPct != null && !closed && (
        <div className="mt-3">
          <OccupancyBar pct={reading.occupancyPct} />
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            <span>{Math.round(reading.occupancyPct * 100)}% full</span>
            {reading.total != null && <span>cap {reading.total}</span>}
          </div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-zinc-500">
        {reading?.observedAt ? `updated ${timeAgo(reading.observedAt)}` : "awaiting first reading"}
        {place.address ? ` · ${place.address}` : ""}
      </div>
    </Link>
  );
}
