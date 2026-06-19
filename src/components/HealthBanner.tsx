import { timeAgo } from "@/lib/format";
import type { SourceHealth } from "@/lib/status";
import { textClass } from "@/lib/tone";

const STATE_TONE: Record<SourceHealth["state"], string> = {
  ok: "emerald",
  degraded: "amber",
  down: "rose",
  idle: "zinc",
};

const STATE_LABEL: Record<SourceHealth["state"], string> = {
  ok: "operational",
  degraded: "degraded — serving last-known data",
  down: "down",
  idle: "no data yet",
};

export function HealthBanner({
  overall,
  sources,
}: {
  overall: "ok" | "degraded" | "down";
  sources: SourceHealth[];
}) {
  if (overall === "ok") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        All sources operational
        <span className="text-emerald-300/60">
          · {sources.map((s) => `${s.source} ✓`).join("  ")}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
      <div className="mb-1 font-medium text-amber-300">
        Some sources are {overall === "down" ? "down" : "degraded"} — showing the most recent
        readings we have.
      </div>
      <ul className="space-y-0.5 text-zinc-400">
        {sources.map((s) => (
          <li key={s.source} className="flex flex-wrap items-center gap-x-2">
            <span className={`font-medium ${textClass(STATE_TONE[s.state])}`}>{s.source}</span>
            <span>{STATE_LABEL[s.state]}</span>
            <span className="text-zinc-600">·</span>
            <span>last success {timeAgo(s.lastSuccessAt)}</span>
            {s.lastError && <span className="text-zinc-600">· {s.lastError.slice(0, 80)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
