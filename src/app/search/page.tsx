import Link from "next/link";
import type { Metadata } from "next";
import { getItemSearch } from "@/lib/queries";

export const metadata: Metadata = { title: "아이템 검색" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = await getItemSearch(q);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--accent)]">아이템 검색</h1>

      <form className="flex gap-2" action="/search" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="아이템 이름 또는 베이스 (예: Recurve Bow)"
          className="w-full max-w-md rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)]"
        >
          검색
        </button>
      </form>

      {results.length === 0 ? (
        <p className="opacity-60">
          결과가 없습니다. <code>npm run db:seed</code> 또는 <code>npm run collect</code> 실행 후
          데이터가 채워집니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel)] text-xs uppercase opacity-70">
              <tr>
                <th className="px-4 py-2">아이템</th>
                <th className="px-4 py-2">카테고리</th>
                <th className="px-4 py-2">중앙값 가격</th>
                <th className="px-4 py-2">유효 매물</th>
                <th className="px-4 py-2">전체 매물</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {r.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.iconUrl}
                          alt=""
                          loading="lazy"
                          className="h-8 w-8 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded bg-[var(--border)]" />
                      )}
                      <div>
                        <Link href={`/items/${r.id}`} className="text-[var(--accent)] hover:underline">
                          {r.name}
                        </Link>
                        <div className="text-xs opacity-50">{r.baseType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 opacity-80">{r.category}</td>
                  <td className="px-4 py-2">{r.medianPrice ?? "—"}</td>
                  <td className="px-4 py-2">{r.validListings}</td>
                  <td className="px-4 py-2">{r.totalListings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
