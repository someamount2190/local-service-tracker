import { NextResponse } from "next/server";
import { getPlacesWithStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const category = new URL(req.url).searchParams.get("category") ?? undefined;
  const views = await getPlacesWithStatus(category);
  return NextResponse.json({
    count: views.length,
    places: views.map((v) => ({
      id: v.place.id,
      slug: v.place.slug,
      name: v.place.name,
      category: v.place.category,
      source: v.place.source,
      lat: v.place.lat,
      lng: v.place.lng,
      capacity: v.place.capacity,
      address: v.place.address,
      status: v.reading?.status ?? "unknown",
      available: v.reading?.available ?? null,
      total: v.reading?.total ?? null,
      occupancyPct: v.reading?.occupancyPct ?? null,
      waitMinutes: v.reading?.waitMinutes ?? null,
      observedAt: v.reading?.observedAt ?? null,
      freshness: v.freshness,
      ageSeconds: v.ageSeconds,
    })),
  });
}
