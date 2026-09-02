# Perky — 작업 규칙

청년 주거지원금 실부담 계산기. `apps/web/` (Next.js 15 App Router + TS + Tailwind 4, `output: "export"`, Vitest).

## 절대 원칙

**F0-5 — 추정 금지.** 확인 못 한 값은 절대 추정하지 않는다. `null`로 두고 `notes`에 "확인 필요"라고 남긴 뒤
`docs/기획/2026-09-02-전국화Phase1-확인목록.md`에 항목을 추가한다. 그럴듯한 숫자를 채워 넣는 것이
이 앱에서 제일 큰 사고다.

**원문 대조.** 온통청년 API의 설명 필드만 보고 등록하지 않는다. 반드시 브라우저로 지자체 공고 원문까지
열어 확인한다. 원문을 못 찾았으면 `verifiedAt: null` + `notes`에 "미검증 초안"으로 명시한다.

**브랜치.** 작업은 피처 브랜치에서. **명시적으로 요청받기 전에는 push·PR 금지.** 로컬 커밋만.

**손대지 말 것.** `apps/web/app/components/BenefitResultCard.tsx`, `apps/web/lib/benefit-result.ts`,
그리고 `app/components/index.ts` · `lib/types.ts`의 관련 diff — 다른 사람 작업이다.
스테이징·커밋에 절대 포함하지 않는다. `git status`에 계속 뜨는 게 정상.

## 데이터 3분류

| 파일 | 타입 | 성격 |
|---|---|---|
| `data/policies.json` | `PolicyMeta` | 금액 계산에 들어가는 현금성 지원 |
| `data/loan-products.json` | `LoanProductMeta` | 대출·이자지원. 정보 제공만, 계산 안 함 |
| `data/housing-supply.json` | `HousingSupplyMeta` | 현물 공급(임대주택·기숙사). 정보 제공만 |

계산 파이프라인(`lib/benefit.ts`, `lib/combinations.ts`)은 새 항목이 진짜로 거기 속할 때만 건드린다.

## 정책 1건 추가할 때 손대는 곳

1. `data/policies.json` — 엔트리 추가
2. `lib/policy-rules.ts` — `RuleFn` 작성 후 `POLICY_RULES` 맵에 등록
   - 헬퍼: `ageCheck` / `boolCheck` / `maxCeilingCheck` / `rangeCheck`
   - 소득 **구간**(하한 초과~상한 이하)은 `maxCeilingCheck`가 아니라 `rangeCheck`
   - 앱이 아예 묻지 않는 조건은 `{ key, label, result: "unknown", howToConfirm }` 리터럴로
3. `lib/region.ts` — 새 지역이면 `REGION_HIERARCHY`에 추가
   - 시군구 추가 시 `catchAll.label`/`chipLabel`은 갱신하되 **`catchAll.value`는 절대 안 바꾼다**(= 시도명 그대로, `region.test.ts`가 검증)
4. 테스트 4종 — 하드코딩된 개수·배열이라 추가할 때마다 깨진다. 실패 diff 보고 갱신:
   - `lib/__tests__/discovery.test.ts` (해당없음 id 배열)
   - `lib/__tests__/region.test.ts` (`isRegionValue` 음성 예시가 유효 지역이 되면 교체)
   - `app/__tests__/find.test.tsx`, `app/__tests__/find-policies.test.tsx` (개수)
5. `docs/기획/온통청년-주거후보.md` — 라운드별 판정 표(✅/⏸/⛔/🔁)에 기록

## 검증

끝났다고 말하기 전에 셋 다 통과시킨다 (바이너리 직접 호출):

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
npm run build
```

⚠️ `next build`는 실행 중인 dev 서버의 webpack manifest를 깨뜨린다(`Cannot find module './XXX.js'` 500).
빌드 후에는 반드시 `preview_stop` → `preview_start`로 dev 서버를 새로 띄운다.

**UI 확인은 localStorage 직접 주입이 빠르다.** 마법사를 클릭으로 통과하지 말고:

```js
localStorage.setItem('perky.answers', JSON.stringify({ birthDate, region, status, incomeBracket, housingType }));
localStorage.setItem('perky.answered', JSON.stringify([...]));
```
→ `/find/policies`로 이동. `housing-supply.json` 항목은 `/result`에서만 보이므로
`housing-benefit:listing`의 `region`을 바꾼 뒤 `/result`로 간다.

## 지금 상태 (2026-09-03)

정책 31건 / 대출 6건 / 공급 3건. 광역(17개 시도) 전수 검토 완료, 시군구 10라운드까지 완료.

**남은 큐 —** 사실상 **울릉군 1곳뿐**. `docs/기획/온통청년-주거후보.md` 하단
라운드 표 참고:
- 울릉군 "울릉섬 청년 주거비 지원사업" — 19~49세 무주택 청년·신혼부부, 월 최대20만원
  (신혼부부30만원), 조건은 다 확인했지만 **신청기간을 못 찾음** — 확인목록.md 18번
- **확정 스킵(재확인 불필요)**: 경남 남해군(대출상품 후보뿐)·충북 충주시(신혼부부 전용)·
  제천시·경기 군포시·포천시·경북 청도군·의성군·예천군·울진군·대구 서구(전부 국비
  청년월세 재게시이거나 대상 협소로 9·10라운드에서 확정)

**⚠️ PDF 원문 열람 팁** — 이 환경엔 poppler(`pdftoppm`)가 없어 `Read` 도구로 PDF를
못 열지만, `pdftotext -enc UTF-8 -layout 원본.pdf 출력.txt`(Xpdf, `/mingw64/bin/`에
있음)로는 한글까지 온전히 뽑힌다. PDF만 있는 원문을 만나면 WebFetch나 curl로
받아서 이 명령부터 시도할 것 — 확인목록.md 18번에 상세 기록.
- 인천은 8개 구·군(중구·동구·영종구·제물포구·강화군·옹진군·서해구·검단구) 전수 완료 — 더 볼 곳 없음(단, 아래 행정구역 개편 이슈는 미해결)
- `loan-products` 원문 미대조 5건: 부산 머물자리론, 광주·세종·대구 이자지원, 경기 군포시
- 미검증 초안 2건: `seoul-youth-moving-cost-support`, `goryeong-youth-rent-support`
- 사실 확인 필요: `gumi-youth-rent-support` 하반기 신청기간(9월말~10월초 예정, 정확한 날짜 미확인) — 확인목록.md 15번
- 팀 판단 필요: 인천청년포털에서 중구·동구·서구가 완전히 사라지고 서해구·검단구로 대체됨 — 이미 등록된 `incheon-junggu-moving-cost-support`·`incheon-donggu-welcome-pay`의 regionScope 처리 — 확인목록.md 14·17번
- 울릉군은 최신 조건이 19.6MB 소식지 PDF에만 있어 텍스트 추출 실패, 다음 라운드로 이월

**막힌 것 —** `docs/기획/2026-09-02-전국화Phase1-확인목록.md`:
- 14번 ⚠️ 2026-07-01 인천 행정체제 개편(중구·동구 폐지 → 제물포구·영종구, 서구 분구). 이미 등록된
  중구·동구 엔트리가 개편 후에도 유효한지 미해결. 인천시 행정체제개편지원과 문의 필요
- 13번 고령군 원문 PDF 미확인
- "전남광주통합특별시" 명칭 모호성
