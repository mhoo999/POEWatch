import Link from "next/link";

const FEATURES = [
  { href: "/search", title: "아이템 검색", desc: "중앙값 가격 · 유효 매물 · 전체 매물 (PRD §3.1)" },
  { href: "/meta", title: "Meta Radar", desc: "옵션 조합별 시장 점유율 변화 (PRD §3.4)" },
  { href: "/hot", title: "Hot Market", desc: "24시간 급등락 TOP 20 (PRD §3.5)" },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-[var(--accent)]">POE2 Meta Radar</h1>
        <p className="max-w-2xl opacity-80">
          Path of Exile 2 거래소 데이터를 수집·정규화하여 아이템 가격, 유효 공급량,
          옵션 조합, 메타 변화를 탐지하는 경제 분석 플랫폼입니다. 단순 시세 조회가 아닌,
          물리 활 → 크리 활 같은 <strong>메타 전환</strong>을 데이터로 확인하는 것이 목표입니다.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]"
          >
            <h2 className="mb-1 font-semibold text-[var(--accent)]">{f.title}</h2>
            <p className="text-sm opacity-70">{f.desc}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-2 font-semibold">프로젝트 현황 (Foundation Scaffold)</h2>
        <ul className="space-y-1 text-sm opacity-80">
          <li>✅ 데이터 모델 (Prisma / Postgres) — PRD §10</li>
          <li>✅ POE2 거래 API 수집기 (활 매물, <code>npm run collect</code>) — PRD Phase 1</li>
          <li>✅ 옵션 정규화 골격 (ModKey) — PRD §3.3</li>
          <li>✅ 핵심 API 라우트 — PRD §9</li>
          <li>⏳ 메타 분석 · 이상치 제거 · 차트 — 이후 단계</li>
        </ul>
      </section>
    </div>
  );
}
