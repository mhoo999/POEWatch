import { getMetaRadar } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/meta/radar
export async function GET() {
  const points = await getMetaRadar();
  return Response.json({ count: points.length, points });
}
