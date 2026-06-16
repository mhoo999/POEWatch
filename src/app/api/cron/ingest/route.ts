import { NextRequest } from "next/server";
import { runIngest } from "@/lib/ingest";

// Long-running DB writes; never prerender, run on Node (Prisma needs it).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron target (configured in vercel.json). Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set in the
 * project env; we reject anything else so the endpoint isn't publicly runnable.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await runIngest();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
