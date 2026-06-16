# POE2 Meta Radar (poewatch) — 서비스 설명 & 동작 원리

> Path of Exile 2 거래소 데이터를 **수집 → 정규화 → 저장 → 분석 → 시각화**하여
> 아이템 가격·유효 공급량·옵션 조합·**메타 전환**을 추적하는 경제 분석 플랫폼.

이 문서는 코드베이스의 실제 동작을 기준으로 작성되었습니다. 제품 기획은 PRD v2.1,
실행 가이드는 [`README.md`](../README.md)를 참고하세요.

---

## 1. 무엇을 하는 서비스인가

단순 시세 조회기가 아니라 **메타(빌드/장비 트렌드)의 변화를 데이터로 포착**하는 것이
목표입니다. 예: "물리 활 → 크리 활"로 시장 점유율이 이동하는 흐름을 옵션 조합 점유율로
탐지합니다.

핵심 기능 3가지:

| 기능 | 설명 | 데이터 출처 |
|------|------|------------|
| **아이템 검색** | 유니크별 중앙값 가격 · 유효 공급량 · 전체 매물 | poe.ninja(EE2 프록시) |
| **Meta Radar** | 옵션 조합(예: PHYSICAL/CRIT)별 시장 점유율 시계열 | trade2 매물 정규화 |
| **Hot Market** | 24시간 급등락 TOP (가격/공급 모멘텀) | 시계열(PriceHistory/Supply) |

---

## 2. 전체 아키텍처

```
                     ┌──────────────────────────────────────────┐
                     │             데이터 소스 (외부)             │
                     │                                            │
   유니크 시세(집계) │  poe.ninja PoE2 경제  ──(미러)──▶ EE2 프록시 │
                     │  api.exiledexchange2.dev/proxy/{slug}/...   │
                     │                                            │
   개별 매물(상세)   │  pathofexile.com/api/trade2 (search/fetch)  │
                     └───────────────┬─────────────┬──────────────┘
                                     │             │
                         npm run ingest      npm run collect
                      (src/scripts/ingest)  (src/scripts/collect)
                                     │             │
                                     ▼             ▼
                     ┌──────────────────────────────────────────┐
                     │   수집 파이프라인 (독립 Node / tsx)         │
                     │   fetch → map/normalize → upsert           │
                     └───────────────────┬──────────────────────┘
                                         │ Prisma
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │   PostgreSQL (Neon) — 정규화된 시계열 DB    │
                     │   Item · ItemListing · ItemSnapshot ·      │
                     │   PriceHistory · SupplyHistory ·           │
                     │   MetaTrend · CurrencyRate · ModDefinition │
                     └───────────────────┬──────────────────────┘
                                         │ src/lib/queries.ts (공용 접근층)
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │   Next.js 16 App Router (Vercel)           │
                     │   /api/* (JSON 계약)  +  /search /meta /hot │
                     └──────────────────────────────────────────┘

   자동화: Vercel Cron(매일 06:00 UTC) ──GET──▶ /api/cron/ingest ──▶ runIngest()
```

**설계 원칙**: 수집기는 Vercel(서버리스)이 아니라 **독립 워커/스크립트**로 돌립니다.
거래 API는 느리고 레이트리밋이 강해 서버리스 함수의 수명에 맞지 않기 때문입니다.
다만 가벼운 프록시 인제스트는 cron 라우트(`/api/cron/ingest`)로도 실행됩니다.

---

## 3. 데이터 소스 2가지 (중요)

이 프로젝트에는 성격이 다른 두 개의 수집 경로가 있습니다.

### 3.1 poe.ninja 유니크 시세 — **EE2 프록시 경유** (`npm run ingest`)

- **왜 프록시인가**: poe.ninja의 PoE2 경제 API(`/poe2/api/economy/...`)는 Cloudflare
  뒤에 있어 **브라우저가 아닌 서버 요청에는 404/403**을 반환합니다. 또 PoE2에는
  PoE1의 "dense overview" 단일 엔드포인트가 없어 직접 긁으려면 카테고리마다 호출이
  필요합니다.
- **해법**: Exiled Exchange 2(거래 보조 툴)가 poe.ninja PoE2 데이터를 **CDN 캐시 JSON
  하나**로 미러링합니다. 통화 + 모든 유니크 카테고리를 한 번의 요청으로 받습니다.

  ```
  GET https://api.exiledexchange2.dev/proxy/{slug}/overviewData.json
      slug ∈ league | leaguehc | standard | standardhc
  ```

- **응답 구조** (검증 완료):
  ```jsonc
  {
    "core": { "rates": { "exalted": 177.8, "chaos": 12.34 }, "primary": "divine" },
    "itemOverviews": [
      { "type": "UniqueWeapons", "lines": [
        { "name": "The Dancing Dervish", "variant": "Scimitar",
          "primaryValue": 5180, "detailsId": "the-dancing-dervish-scimitar",
          "sparkline": { "totalChange": -29.4, "data": [ ... ] } }
      ]},
      { "type": "UniqueArmours",  "lines": [ ... ] },
      // UniqueAccessories, UniqueFlasks, UniqueCharms, UniqueJewels,
      // UniqueTablets, UniqueSanctumRelics ...
    ]
  }
  ```

- **가격 단위**: 모든 `primaryValue`는 **Divine Orb 기준**입니다(`core.primary="divine"`).
  `core.rates`는 "1 divine = N개"를 의미: `exalted: 177.8` → 1 divine = 177.8 exalted.
- **집계 소스의 한계**: 프록시는 행당 1개(매물별이 아님)이고 **아이콘 URL·매물 수가
  없습니다**. 따라서 `iconUrl=null`, 공급(`totalListings/validListings`)은 `0`으로
  저장됩니다. 가격·메타·가격 히스토리는 정상 동작합니다.

### 3.2 POE2 공식 거래 API — `trade2` (`npm run collect`)

- **개별 매물(per-listing) 상세**를 가져오는 경로. 옵션(모드)·판매자·가격이 매물 단위로
  들어오므로 **옵션 정규화 → 메타 분석**의 원천이 됩니다.
- 엔드포인트(비공식, 공식 거래 사이트가 사용):
  ```
  POST https://www.pathofexile.com/api/trade2/search/{league}   → 쿼리 id + 최대 100 해시
  GET  https://www.pathofexile.com/api/trade2/fetch/{ids}?query={id}&realm=poe2  → 매물 ≤10개
  ```
- **제약 처리**(`src/lib/poe/client.ts`): search≤100/ fetch≤10 배칭, `Retry-After`/429
  백오프, 폴라이트 딜레이(1.2s), `User-Agent` 필수, 필요 시 `POESESSID` 쿠키.
- 현재 스캐폴드는 **활(Bow) 한 카테고리**만 end-to-end로 증명합니다(`bowQuery()`).
  Cloudflare/인증으로 막히면 `npm run db:seed` 샘플로 나머지 스택을 데모할 수 있습니다.

---

## 4. 데이터 모델 (Prisma / PostgreSQL)

`prisma/schema.prisma` 기준. 핵심은 **정체성(Item)과 관측(시계열)의 분리**입니다.

| 모델 | 역할 |
|------|------|
| **Item** | 아이템의 정체성(이름·베이스·카테고리·희귀도·아이콘). `@@unique([name, baseType, category])`로 멱등 upsert |
| **ItemListing** | 특정 시점의 단일 매물. `rawHash @unique`로 멱등. 가격/판매자/`mods` 보유 |
| **ItemMod** | 매물의 정규화된 모드 1줄(`rawText` + `modKey` + `value`) |
| **ModDefinition** | ModKey의 표시명·그룹·단위(참조 데이터) |
| **ItemSnapshot** | 1회 수집의 집계(중앙값 가격, 전체/유효 매물 수) — 시계열 점 |
| **PriceHistory** | 가격 시계열(기준 통화 값) |
| **SupplyHistory** | 공급량 시계열(전체/유효) |
| **MetaTrend** | 옵션 그룹별 시장 점유율(0~1) 시계열 — Meta Radar의 원천 |
| **CurrencyRate** | 통화 환산율(`1 currency = rate * base`). `core.rates`에서 적재 |
| **MarketAlert** | 관심 아이템 알림(후속 단계 스텁) |

`Category` enum: `BOW · BELT · AMULET · RING · UNIQUE · WEAPON · ARMOUR · OTHER`
`Rarity` enum: `NORMAL · MAGIC · RARE · UNIQUE · UNKNOWN`

> **Neon 연결**: 앱은 `DATABASE_URL`(풀드/pgbouncer), 마이그레이션은
> `DIRECT_URL`(비풀드)을 사용합니다(`datasource db { url, directUrl }`).

---

## 5. 동작 원리 상세

### 5.1 프록시 인제스트 파이프라인 (`runIngest`, `src/lib/ingest.ts`)

```
ninjaClientFromEnv()           # POE_LEAGUE/POENINJA_LEAGUE_SLUG → 프록시 slug 결정
  └▶ client.getOverview()      # 프록시 JSON 1회 fetch
       ├▶ persistRates(core)   # core.rates → CurrencyRate upsert (divine→exalted/chaos)
       └▶ for each itemOverviews(Unique* 만):
            for each line:
              mapNinjaLine(line, type, slug)   # 표준화: 복수형 type→Category, divine 가격
                └▶ persistItem(m):
                     Item.upsert            # 정체성 (iconUrl=null)
                     ItemListing.upsert      # 합성 집계 매물 (rawHash 멱등)
                     ItemSnapshot.create     # 스냅샷 (공급=0, medianPrice=divine)
                     PriceHistory.create     # 가격 시계열 1점 (가격 있을 때)
```

- **멱등성**: `Item`은 (name, baseType, category) 유니크, `ItemListing`은 `rawHash`
  (`ninja-{slug}-{type}-{detailsId}`)로 upsert → **반복 실행해도 중복 없음**.
- **시계열 누적**: 매 실행마다 `ItemSnapshot` + `PriceHistory`에 **새 점**을 append →
  실행을 거듭할수록 실제 가격 추세가 쌓입니다.
- **타입 매핑**(`map.ts`): `UniqueWeapons→WEAPON`, `UniqueArmours→ARMOUR`,
  `UniqueAccessories→AMULET`(혼합 버킷의 근사), 그 외(Flask/Charm/Jewel/Tablet/Relic)
  `→OTHER`.

### 5.2 거래 API 컬렉터 파이프라인 (`src/scripts/collect.ts`)

PRD Phase 1의 정공법: **search → fetch → normalize → persist**.

```
clientFromEnv()
  1. searchListings(bowQuery())        # 활 검색 → 해시 목록(≤20으로 제한)
  2. fetchListings(ids, queryId)       # 10개씩 배칭하여 매물 상세
  3. mapFetchResult(raw, "BOW")        # 원시 → NormalizedListing (모드 정규화 포함)
  4. persist(): Item.upsert + ItemListing.upsert(+mods.create)
  5. 아이템별 ItemSnapshot.create(median 가격, 매물 수)
```

### 5.3 옵션 정규화 (`src/lib/normalize/`, PRD §3.3)

자유 텍스트 모드를 **안정적인 키**로 환원해야 그룹 분석이 가능합니다.

- `modKeys.ts`: `MOD_RULES`(정규식 규칙, **구체적 규칙 우선**) + `MOD_DEFINITIONS`
  (표시명·그룹·단위). 활 관련 키 위주(PHYSICAL/CRIT/SPEED/ELEMENTAL/GEM).
- `normalize.ts`: `normalizeMod(rawText)`가 첫 매칭 규칙으로 `{modKey, value}` 산출.
  "adds X to Y" 범위는 두 수의 **평균**을 값으로 사용.
- 예: `"12% increased Critical Hit Chance"` → `CRITICAL_CHANCE`, value 12.

이 `group`(예: PHYSICAL vs CRIT)이 곧 **Meta Radar의 점유율 축**이 됩니다.

### 5.4 이상치 제거 헬퍼 (`src/lib/analytics/outliers.ts`, PRD §3.6)

"9999 디바인" 같은 가짜 호가를 걸러 **유효 공급량/중앙값**을 구하기 위한 순수 통계 함수:
`median`, `quantile`, `iqrBounds`(IQR ±1.5×), `zScores`, `flagOutliers`. 전체 파이프라인
(판매자 중복 페널티·통화 인지 필터·오래된 매물 제거)은 분석 단계에서 이 위에 얹습니다.

### 5.5 조회층 (`src/lib/queries.ts`)

페이지와 `/api`가 **동일한 계약**(`src/lib/domain/types.ts`)을 쓰도록 공용 데이터 접근
함수를 둡니다. 모두 **방어적**이라 DB 장애 시 크래시 대신 빈 결과로 graceful degrade →
대시보드 셸은 항상 데모 가능.

- `getItemSearch(q)` → 아이템 + 최신 스냅샷 지표(중앙값/유효/전체 매물)
- `getItemDetail(id)` → 아이템 + 최근 매물 50건(+모드)
- `getMetaRadar()` → MetaTrend 최근 100점
- `getHotMarket()` → (현재 스텁, 분석 단계에서 모멘텀 계산)

---

## 6. API 라우트 & 페이지 (Next.js App Router)

| 메서드 | 경로 | 설명 |
|------|------|------|
| GET | `/api/items/search?q=` | 아이템 검색 |
| GET | `/api/items/{id}` | 아이템 상세 + 매물 |
| GET | `/api/meta/radar` | 옵션 그룹 점유율(Meta Radar) |
| GET | `/api/market/hot` | 급등락 TOP(Hot Market) |
| GET | `/api/cron/ingest` | **Vercel Cron 전용**. `Authorization: Bearer ${CRON_SECRET}` 검증 후 `runIngest()` |

페이지: `/`(홈) · `/search`(검색) · `/meta`(Meta Radar) · `/hot`(Hot Market) ·
`/items/[id]`(상세). 라우트 핸들러는 얇은 래퍼이고 실제 로직은 `queries.ts`에 모여 있습니다.

---

## 7. 배포 & 자동화

- **호스팅**: Vercel(Next.js). `postinstall`에서 `prisma generate` 실행(빌드 보장).
- **DB**: Neon PostgreSQL(서버리스). 앱=풀드 URL, 마이그레이션=다이렉트 URL.
- **스케줄**: `vercel.json`의 cron이 매일 **06:00 UTC**에 `/api/cron/ingest`를 호출 →
  `runIngest()`가 프록시에서 최신 시세를 받아 시계열을 한 점 더 쌓습니다.
  Vercel이 `Authorization: Bearer ${CRON_SECRET}` 헤더를 보내며, 라우트는 이를 검증해
  외부 무단 호출을 차단합니다.

---

## 8. 환경 변수

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | 앱용 Postgres(Neon 풀드) |
| `DIRECT_URL` | 마이그레이션용 Postgres(Neon 다이렉트) |
| `POE_LEAGUE` | DB에 저장되는 리그 표시명. 프록시 slug 유도에도 사용 |
| `POENINJA_LEAGUE_SLUG` | 프록시 slug 강제(`league`/`leaguehc`/`standard`/`standardhc`) |
| `POENINJA_BASE` | 프록시 베이스 URL 오버라이드(기본 EE2) |
| `POE_USER_AGENT` | 거래 API 요청 시 필수(연락처 포함 권장) |
| `POESESSID` | 거래 API Cloudflare 우회용 세션 쿠키(선택) |
| `CRON_SECRET` | cron 라우트 인증 시크릿(Vercel와 동일값) |
| `REDIS_URL` | 캐시(ioredis, lazy) |

> slug 유도 규칙(`leagueToSlug`): 이름에 `standard` 포함→standard 계열, `hc/hardcore`
> 포함→하드코어, 그 외→현재 챌린지 리그(`league`).

---

## 9. 현재 상태 · 한계 · 로드맵

**구현됨 (Foundation + 실데이터 인제스트)**
- ✅ 데이터 모델 / 마이그레이션 (Neon)
- ✅ poe.ninja 유니크 인제스트 (EE2 프록시, 8개 카테고리, 멱등, 시계열 누적)
- ✅ 통화 환율 적재(`CurrencyRate`)
- ✅ 거래 API 컬렉터(활 1종) + 옵션 정규화 골격 + 이상치 통계 헬퍼
- ✅ API 계약 + 대시보드 셸 + Vercel cron 자동화

**알려진 한계**
- ⚠️ 프록시 데이터에 **아이콘·매물 수 없음** → `iconUrl=null`, 공급=0
- ⚠️ Meta Radar/Hot Market 계산 로직은 아직 스텁(데이터는 쌓이는 중)
- ⚠️ 거래 API는 비공식·Cloudflare·레이트리밋 → 서버 측 차단 가능

**다음 단계(PRD 로드맵)**
- 아이콘 소스 보강(거래 API 또는 poecdn 매핑), 다중 카테고리 수집기/스케줄러
- 옵션 그룹 분류 → `MetaTrend` 적재 → Meta Radar 실데이터
- 이상치 제거 파이프라인 완성 → 유효 공급량/중앙값 정교화
- Hot Market 모멘텀 계산, 차트 시각화, CI/CD

---

## 10. 빠른 실행 (요약)

```bash
npm install
# .env: DATABASE_URL + DIRECT_URL(Neon) 채우기
npx prisma migrate deploy   # 테이블 생성
npm run ingest              # poe.ninja 유니크 시세 적재(EE2 프록시)
npm run dev                 # http://localhost:3000

# (선택) 거래 API 매물 수집 — POE_USER_AGENT 필요
npm run collect
```
