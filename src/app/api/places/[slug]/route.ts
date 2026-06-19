import { NextResponse } from "next/server";
import { getPlaceBySlug } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const result = await getPlaceBySlug(slug);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { view, history } = result;
  return NextResponse.json({
    place: {
      id: view.place.id,
      slug: view.place.slug,
      name: view.place.name,
      category: view.place.category,
      source: view.place.source,
      lat: view.place.lat,
      lng: view.place.lng,
      capacity: view.place.capacity,
      address: view.place.address,
      url: view.place.url,
    },
    status: {
      status: view.reading?.status ?? "unknown",
      available: view.reading?.available ?? null,
      total: view.reading?.total ?? null,
      occupancyPct: view.reading?.occupancyPct ?? null,
      waitMinutes: view.reading?.waitMinutes ?? null,
      observedAt: view.reading?.observedAt ?? null,
      freshness: view.freshness,
      ageSeconds: view.ageSeconds,
    },
    history: history.map((r) => ({
      observedAt: r.observedAt,
      fetchedAt: r.fetchedAt,
      status: r.status,
      available: r.available,
      total: r.total,
      occupancyPct: r.occupancyPct,
      waitMinutes: r.waitMinutes,
      isStale: r.isStale,
    })),
  });
}
