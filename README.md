# POE2 Meta Radar (poewatch)

Path of Exile 2 거래소 데이터를 수집·정규화하여 아이템 가격, 유효 공급량, 옵션 조합,
메타 변화를 탐지하는 경제 분석 플랫폼. 자세한 제품 정의는 PRD v2.1 참고.

> **현재 상태: Foundation Scaffold.** 아키텍처 골격(데이터 모델 · 실제 거래 API 수집
> 경로 · 옵션 정규화 골격 · API 계약 · 대시보드 셸)이 구축되어 있고, 메타 분석/이상치
> 제거/차트 등은 이후 단계에서 채웁니다.

## 기술 스택

- **Next.js 16 (App Router) + TypeScript** — 프론트엔드 + API Route Handlers (Vercel 배포 대상)
- **Prisma + PostgreSQL** — 데이터 저장 (PRD §10)
- **Redis (ioredis)** — 캐싱 (lazy connect)
- **수집기** — `tsx`로 실행되는 독립 Node 스크립트 (Vercel이 아닌 별도 워커에서 주기 실행)

## 디렉터리

```
prisma/schema.prisma     데이터 모델 (PRD §10)
prisma/seed.ts           참조 데이터 + 샘플 시드
src/app/                 App Router 페이지 + /api 라우트 (PRD §9)
src/lib/db.ts            Prisma 싱글톤
src/lib/redis.ts         Redis 싱글톤
src/lib/queries.ts       페이지/API 공용 데이터 접근
src/lib/poe/             POE2 trade2 API 클라이언트 · 쿼리 · 매퍼
src/lib/normalize/       옵션 정규화 (ModKey 매핑, PRD §3.3)
src/lib/analytics/       이상치 제거 헬퍼 (PRD §3.6)
src/scripts/collect.ts   수집기 진입점 (search → fetch → normalize → persist)
```

## 시작하기

```bash
npm install
cp .env.example .env        # 값 채우기 (DATABASE_URL, REDIS_URL, POE_*)
npm run db:generate         # Prisma 클라이언트 생성
npm run db:migrate          # 스키마를 DB에 적용 (PostgreSQL 필요)
npm run db:seed             # 참조 데이터 + 샘플 데이터 시드 (선택)
npm run dev                 # http://localhost:3000
```

## 데이터 수집 (실제 POE2 거래 API)

```bash
npm run collect
```

활(Bow) 매물을 `trade2` search/fetch 엔드포인트에서 수집해 정규화 후 저장합니다.

> ⚠️ **주의:** 거래 API는 GGG가 공식 문서화하지 않으며 Cloudflare 뒤에 있고 강한
> 레이트 리밋이 적용됩니다. 서버 측 요청이 차단되면 `.env`에 유효한 `POESESSID`와
> 설명적 `POE_USER_AGENT`를 설정하세요. 그래도 막히면 `npm run db:seed`의 샘플
> 데이터로 나머지 스택을 데모할 수 있습니다.

## API 라우트 (PRD §9)

| 메서드 | 경로                  | 설명                         |
| ------ | --------------------- | ---------------------------- |
| GET    | `/api/items/search`   | 아이템 검색 (`?q=`)          |
| GET    | `/api/items/{id}`     | 아이템 상세 + 매물           |
| GET    | `/api/meta/radar`     | 옵션 그룹 점유율 (Meta Radar)|
| GET    | `/api/market/hot`     | 급등락 TOP (Hot Market)      |

## 이후 단계 (PRD 로드맵)

다중 카테고리 수집기/스케줄러, 활 그룹 분류 + Meta Radar 분석, 이상치 제거 파이프라인,
Hot Market 계산, 차트 시각화, CI/CD·배포.
