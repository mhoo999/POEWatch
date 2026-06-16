import type { Metadata } from "next";
import { getHotMarket } from "@/lib/queries";

export const metadata: Metadata = { title: "Hot Market" };
export const dynamic = "force-dynamic";

export default async function HotMarketPage() {
  const entries = await getHotMarket();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--accent)]">Hot Market</h1>
        <p className="opacity-70">최근 24시간 가격·공급 급등락 TOP 20. — PRD §3.5</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center opacity-60">
          <p>아직 급등락 데이터가 없습니다.</p>
          <p className="mt-1 text-sm">
            모멘텀/공급 속도 계산은 분석 단계에서 구현됩니다. 스캐폴드는 API 계약
            (<code>/api/market/hot</code>)을 제공합니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.itemId}
              className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm"
            >
              <span>{e.name}</span>
              <span className={e.changePct >= 0 ? "text-green-400" : "text-red-400"}>
                {e.changePct >= 0 ? "+" : ""}
                {e.changePct.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
