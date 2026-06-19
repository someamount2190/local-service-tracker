/**
 * Tailwind v4 only emits classes it can see as literal strings in source, so we
 * map semantic tones to fully-spelled class names here instead of building
 * names like `bg-${tone}-500` (which would get purged).
 */
type Tone = "emerald" | "sky" | "amber" | "rose" | "zinc";

const BG: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  zinc: "bg-zinc-500",
};

const BADGE: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  zinc: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

const TEXT: Record<Tone, string> = {
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  zinc: "text-zinc-400",
};

const STROKE: Record<Tone, string> = {
  emerald: "stroke-emerald-400",
  sky: "stroke-sky-400",
  amber: "stroke-amber-400",
  rose: "stroke-rose-400",
  zinc: "stroke-zinc-400",
};

const isTone = (t: string): t is Tone => t in BG;

export const bgClass = (t: string) => (isTone(t) ? BG[t] : BG.zinc);
export const badgeClass = (t: string) => (isTone(t) ? BADGE[t] : BADGE.zinc);
export const textClass = (t: string) => (isTone(t) ? TEXT[t] : TEXT.zinc);
export const strokeClass = (t: string) => (isTone(t) ? STROKE[t] : STROKE.zinc);
