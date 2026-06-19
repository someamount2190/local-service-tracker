import { occupancyTone } from "@/lib/format";
import { bgClass } from "@/lib/tone";

export function OccupancyBar({ pct }: { pct: number | null }) {
  const width = pct == null ? 0 : Math.round(Math.max(0, Math.min(1, pct)) * 100);
  const tone = occupancyTone(pct);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className={`h-full rounded-full transition-all ${bgClass(tone)}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
