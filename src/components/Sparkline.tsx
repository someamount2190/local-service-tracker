import { strokeClass } from "@/lib/tone";

/**
 * Minimal dependency-free SVG sparkline. `values` are chronological (oldest →
 * newest); nulls create gaps. `max` fixes the vertical scale (e.g. capacity or
 * a wait-minute ceiling) so charts are comparable across reloads.
 */
export function Sparkline({
  values,
  max,
  tone = "sky",
  height = 80,
}: {
  values: (number | null)[];
  max: number;
  tone?: string;
  height?: number;
}) {
  const width = 600;
  const n = values.length;
  if (n < 2 || max <= 0) {
    return <div className="text-xs text-zinc-500">Not enough history yet.</div>;
  }
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (v: number) => height - (Math.max(0, Math.min(max, v)) / max) * (height - 6) - 3;

  // Build path with gaps for null segments.
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none">
      <line x1="0" y1={height - 3} x2={width} y2={height - 3} className="stroke-zinc-800" strokeWidth="1" />
      <path d={d} fill="none" strokeWidth="2" className={strokeClass(tone)} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
