import { NextRequest } from "next/server";
import { getItemSearch } from "@/lib/queries";

// Hits the DB at request time; never prerender.
export const dynamic = "force-dynamic";

// GET /api/items/search?q=mageblood
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const results = await getItemSearch(q);
  return Response.json({ query: q ?? null, count: results.length, results });
}
