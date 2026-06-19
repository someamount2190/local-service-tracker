import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceBySlug } from "@/lib/status";
import { availabilityLabel, categoryMeta, headline, occupancyTone, timeAgo } from "@/lib/format";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { OccupancyBar } from "@/components/OccupancyBar";
import { Sparkline } from "@/components/Sparkline";
import { AutoRefresh } from "@/components/AutoRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPlaceBySlug(slug);
  if (!result) notFound();

  const { view, history } = result;
  const { place, reading, freshness } = view;
  const cat = categoryMeta(place.category);
  const h = headline(place.category, reading);
  const isClinic = place.category === "clinic";

  // Chronological values for the sparkline.
  const chrono = [...history].reverse();
  const values = chrono.map((r) =>
    isClinic ? r.waitMinutes : r.occupancyPct != null ? Math.round(r.occupancyPct * 100) : null,
  );
  const chartMax = isClinic ? 60 : 100;
  const chartTone = isClinic ? "rose" : occupancyTone(reading?.occupancyPct ?? null);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={45} />
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">
        ← All places
      </Link>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="text-zinc-600">· source: {place.source}</span>
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-50">{place.name}</h2>
            {place.address && <p className="text-sm text-zinc-400">{place.address}</p>}
          </div>
          <FreshnessBadge freshness={freshness} />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-8">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tabular-nums text-zinc-50">{h.value}</span>
              <span className="text-sm text-zinc-400">{h.unit}</span>
            </div>
            {!isClinic && reading?.total != null && (
              <div className="mt-3 w-64 max-w-full">
                <OccupancyBar pct={reading.occupancyPct ?? null} />
                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>
                    {reading.occupancyPct != null ? `${Math.round(reading.occupancyPct * 100)}% full` : "—"}
                  </span>
                  <span>capacity {reading.total}</span>
                </div>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-zinc-500">Status</dt>
            <dd className="capitalize text-zinc-200">{reading?.status ?? "unknown"}</dd>
            <dt className="text-zinc-500">Source time</dt>
            <dd className="text-zinc-200">{reading ? timeAgo(reading.observedAt) : "—"}</dd>
            {!isClinic && (
              <>
                <dt className="text-zinc-500">{availabilityLabel(place.category)}</dt>
                <dd className="text-zinc-200">{reading?.available ?? "—"}</dd>
              </>
            )}
            {reading?.isStale && (
              <>
                <dt className="text-amber-400">⚠ Note</dt>
                <dd className="text-amber-300">Upstream reading is stale</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h3 className="mb-1 text-sm font-medium text-zinc-200">
          {isClinic ? "Wait time" : "Occupancy"} — recent history
        </h3>
        <p className="mb-4 text-xs text-zinc-500">
          Last {history.length} readings ({isClinic ? "minutes waited" : "% full"}). Gaps are
          missing/stale data.
        </p>
        <Sparkline values={values} max={chartMax} tone={chartTone} />
      </div>

      {place.lat != null && place.lng != null && (
        <a
          className="inline-block text-sm text-sky-400 hover:text-sky-300"
          href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Maps →
        </a>
      )}
    </div>
  );
}
