import { maybeRefresh } from "@/lib/refresh";
import { getHealth, getPlacesWithStatus } from "@/lib/status";
import { CATEGORIES } from "@/lib/format";
import { StatusCard } from "@/components/StatusCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { HealthBanner } from "@/components/HealthBanner";
import { AutoRefresh } from "@/components/AutoRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  // Opportunistic, TTL-guarded refresh on view. First load populates the DB.
  await maybeRefresh().catch(() => {});

  const [all, health] = await Promise.all([getPlacesWithStatus(), getHealth()]);

  const counts: Record<string, number> = {};
  for (const c of CATEGORIES) counts[c.key] = 0;
  for (const v of all) counts[v.place.category] = (counts[v.place.category] ?? 0) + 1;

  const views = category ? all.filter((v) => v.place.category === category) : all;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={60} />
      <HealthBanner overall={health.overall} sources={health.sources} />
      <CategoryFilter active={category} counts={counts} />

      {all.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
          <p className="text-zinc-200">No data yet.</p>
          <p className="mt-2">
            Run <code className="rounded bg-zinc-800 px-1.5 py-0.5">npm run db:setup</code> then{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5">npm run seed</code>, or just reload —
            the page triggers a refresh automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((v) => (
            <StatusCard key={v.place.id} view={v} />
          ))}
        </div>
      )}
    </div>
  );
}
