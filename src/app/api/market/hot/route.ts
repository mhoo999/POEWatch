import { getHotMarket } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/market/hot
export async function GET() {
  const entries = await getHotMarket();
  return Response.json({ count: entries.length, entries });
}
