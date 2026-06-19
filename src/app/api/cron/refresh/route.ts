import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/refresh";

// PGlite (local) needs the Node runtime + filesystem; Neon works here too.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled refresh endpoint. Vercel Cron calls this on the schedule in
 * vercel.json with `Authorization: Bearer ${CRON_SECRET}`. Also callable
 * manually (e.g. `npm run refresh`). Pass ?force=1 to bypass the TTL guard.
 */
async function handle(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const started = Date.now();
  try {
    const results = await refreshAll(force);
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - started,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
