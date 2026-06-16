import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/search" className="text-sm opacity-60 hover:opacity-100">
          ← 검색으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--accent)]">{item.name}</h1>
        <p className="opacity-60">
          {item.baseType} · {item.category}
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">매물 ({item.listings.length})</h2>
        {item.listings.length === 0 ? (
          <p className="opacity-60">수집된 매물이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {item.listings.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-[var(--accent)]">
                    {l.priceAmount != null ? `${l.priceAmount} ${l.priceCurrency ?? ""}` : "가격 미표기"}
                  </span>
                  <span className="text-xs opacity-50">{l.sellerAccount ?? "익명"}</span>
                </div>
                <ul className="space-y-0.5 text-sm opacity-80">
                  {l.mods.map((m, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{m.rawText}</span>
                      {m.modKey && (
                        <span className="shrink-0 text-xs opacity-50">{m.modKey}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
