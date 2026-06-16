import { getItemDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/items/{id}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }
  return Response.json(item);
}
