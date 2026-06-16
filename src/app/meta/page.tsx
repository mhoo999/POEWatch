import type { Metadata } from "next";
import { getMetaRadar } from "@/lib/queries";

export const metadata: Metadata = { title: "Meta Radar" };
export const dynamic = "force-dynamic";

export default async function MetaRadarPage() {
  const points = await getMetaRadar();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--accent)]">Meta Radar</h1>
        <p className="opacity-70">
          옵션 조합별 시장 점유율 변화를 추적합니다 (예: Physical Bow vs Crit Bow). — PRD §3.4
        </p>
      </div>

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center opacity-60">
          <p>아직 메타 트렌드 데이터가 없습니다.</p>
          <p className="mt-1 text-sm">
            점유율 계산(그룹 분류 + 시계열 집계)은 분석 단계에서 구현됩니다. 스캐폴드는
            <code> MetaTrend </code> 모델과 API 계약(<code>/api/meta/radar</code>)을 제공합니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {points.map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm"
            >
              <span className="font-medium">{p.group}</span>
              <span>{(p.share * 100).toFixed(1)}%</span>
              <span className="opacity-50">n={p.sampleN}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
