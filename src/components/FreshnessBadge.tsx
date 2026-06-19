import { freshnessMeta } from "@/lib/format";
import type { Freshness } from "@/lib/status";
import { badgeClass } from "@/lib/tone";

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const { label, tone } = freshnessMeta(freshness);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badgeClass(tone)}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {freshness === "live" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${badgeClass(tone).split(" ")[0]}`} />
      </span>
      {label}
    </span>
  );
}
