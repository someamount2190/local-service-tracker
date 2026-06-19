import { NextResponse } from "next/server";
import { getHealth } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const health = await getHealth();
  const status = health.overall === "down" ? 503 : 200;
  return NextResponse.json(health, { status });
}
