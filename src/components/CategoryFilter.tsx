import Link from "next/link";
import { CATEGORIES } from "@/lib/format";

export function CategoryFilter({
  active,
  counts,
}: {
  active?: string;
  counts: Record<string, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const item = (key: string | undefined, label: string, icon: string, count: number) => {
    const isActive = (key ?? "") === (active ?? "");
    return (
      <Link
        key={key ?? "all"}
        href={key ? `/?category=${key}` : "/"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
          isActive
            ? "border-zinc-500 bg-zinc-100 text-zinc-900"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
        }`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        <span className={isActive ? "text-zinc-500" : "text-zinc-600"}>{count}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {item(undefined, "All", "", total)}
      {CATEGORIES.map((c) => item(c.key, c.label, c.icon, counts[c.key] ?? 0))}
    </div>
  );
}
