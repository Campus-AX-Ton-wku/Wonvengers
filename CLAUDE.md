# Perky — 작업 규칙

청년 주거지원금 실부담 계산기. `apps/web/` (Next.js 15 App Router + TS + Tailwind 4, `output: "export"`, Vitest).

## 절대 원칙

**F0-5 — 추정 금지.** 확인 못 한 값은 절대 추정하지 않는다. `null`로 두고 `notes`에 "확인 필요"라고 남긴 뒤
`docs/기획/2026-09-02-전국화Phase1-확인목록.md`에 항목을 추가한다. 그럴듯한 숫자를 채워 넣는 것이
이 앱에서 제일 큰 사고다.

**원문 대조.** 온통청년 API의 설명 필드만 보고 등록하지 않는다. 반드시 브라우저로 지자체 공고 원문까지
열어 확인한다. 원문을 못 찾았으면 `verifiedAt: null` + `notes`에 "미검증 초안"으로 명시한다.

**브랜치.** 작업은 피처 브랜치에서. **명시적으로 요청받기 전에는 push·PR 금지.** 로컬 커밋만.

**손대지 말 것.** Benefit Result Card 리디자인(`apps/web/app/result/BenefitResultCard.tsx`,
`apps/web/lib/benefit-result.ts`, `apps/web/app/result/ResultState.tsx` 등)은 다른 사람 작업이다.
2026-09-03에 develop으로 머지됐다(PR #90·#92·#94) — 이제 `git status`에 계속 뜨지는 않지만,
여전히 이유 없이 건드리지 않는다. (예전엔 `app/components/BenefitResultCard.tsx` 경로의
미완성 초안이 로컬에 커밋 안 된 채로 계속 남아 있었는데, develop 머지 시 최종본으로 교체됐다.)

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

정책 35건 / 대출 13건 / 공급 4건. 광역(17개 시도) 전수 검토 완료 ~~였는데
대전이 통째로 빠져 있었다~~ — 14·15라운드에서 발견해 대전을 새로 추가하고
3건 등록. 17라운드에서 전라남도(강진군)를 처음 등록해 시군구 등록 시도가
15개로 늘었다 — loan-products·미검증 초안 큐는 여전히 비어 있지만, 시군구
확장 큐는 전남 잔여 후보(아래) 때문에 다시 열렸다.

**대전광역시 — 14·15라운드에서 완료.** 사용자가 "대전은 없냐"고 물어서
확인해보니 17개 시도 중 대전만 유일하게 한 번도 검토된 적이 없었다(이전
"광역 전수 검토 완료" 기록은 부정확했음). 3건 등록: `daejeon-youth-rent-support`
(정책, 19~39세·중위120%·월최대20만원×12개월 — **신청기간 2026.8.31~9.10,
지금 접수 중인 첫 정책**), `daejeon-youth-housing-deposit-loan-interest`
(대출, 청년·청년부부 임차보증금 이자지원), `daejeon-youth-house`(공급,
청년근로자 전용 기숙사 226실). 대전형 청년주택(2만호 공급 목표)의 개별
신규 건설 단지들은 아직 미확인 — 다음 라운드로. 15라운드에서 강원·충남·
전남도 "대전형처럼 숨은 자체사업이 있는지" 스팟체크했지만 없었다(기존
판단이 맞았음, 강원은 moland 재보도임을 재확인).

**시군구 확장 큐 —** 16라운드에서 울릉군까지 해결해 한 번 비었다가, 17라운드에서
전남을 도 단위가 아니라 시·군 단위로 다시 보면서 다시 열렸다. `docs/기획/온통청년-주거후보.md`
하단 라운드 표 참고:
- 경상북도: 고령군·구미시·울릉군 3곳 완료
- 경상남도: 하동·산청·합천·통영·창원·남해 6개 시·군 전부 완료
- 전라남도: 강진군 1곳 완료(`gangjin-youth-worker-rent-support`) — **다음 라운드
  최우선**: 함평군·광양시·순천시·목포시·곡성군·해남군(강진 공고 원문에 "해남형
  청년 주거비 지원사업"으로 직접 언급됨) — 강진군과 같은 이름("청년 취업자
  주거비 지원사업")의 도 차원 공통 템플릿을 각 군이 자체 집행 중일 가능성이 있다
- **확정 스킵(재확인 불필요)**: 충북 충주시(신혼부부 전용)·제천시·경기 군포시·포천시·
  경북 청도군·의성군·예천군·울진군·대구 서구(전부 국비 청년월세 재게시이거나 대상
  협소로 9·10라운드에서 확정)

**loan-products 큐 —** 원래 5건(부산 머물자리론·세종·대구·광주·경기 군포시)에
13라운드의 남해군까지 더해 6건 전부 원문 대조·등록 완료 — 이 큐는 비었다.
광주만 시 원 공고문이 아니라 언론 기사를 원문으로 썼으니 다음에 시 공고문으로
교차검증하면 좋다.

**미검증 초안 큐 —** 12라운드에서 `goryeong-youth-rent-support`(값 갱신: 소득기준
추가, 신청기간 1차→2차 교체)·`seoul-youth-moving-cost-support`(나이 확정) 둘 다
원문 공고문 PDF로 검증 완료 — `verifiedAt` 채움. 이 큐도 비었다. 남은 건 서울 이사비
하반기 정확한 날짜(8월 예정까지만 확인)와 전입일자·거래금액 같은 스키마 갭 — 팀
판단 필요.

**⚠️ 경남바로서비스(baro.gyeongnam.go.kr) 지역필터 팁** — "서비스 신청하기" 목록의
시군 select는 jQuery로 바인딩돼 있어 `element.value = X` + `dispatchEvent('change')`가
안 먹힌다. URL 쿼리 파라미터로 직접 필터링할 것: `/baro/service.es?mid=a10202000000&srh_loc=<코드>`
(코드는 select의 option value, 예: 남해군=NH). 페이지네이션은 `javascript:goPage(N)`
함수를 `javascript_tool`로 직접 호출.

**⚠️ PDF 원문 열람 팁** — 이 환경엔 poppler(`pdftoppm`)가 없어 `Read` 도구로 PDF를
못 열지만, `pdftotext -enc UTF-8 -layout 원본.pdf 출력.txt`(Xpdf, `/mingw64/bin/`에
있음)로는 한글까지 온전히 뽑힌다. PDF만 있는 원문을 만나면 WebFetch나 curl로
받아서 이 명령부터 시도할 것 — 확인목록.md 18번에 상세 기록.

**⚠️ hwpx 원문 열람 팁 (17라운드)** — hwp/hwpx는 이 환경에 변환 도구가 전혀 없어
(soffice·libreoffice·hwp5html 전부 없음) pdftotext도 못 쓴다. 게시판 상세페이지에
'바로보기'(`Viewer_xxx/idx_n` 형태) 링크가 있으면 SynapSoft 등 웹 문서뷰어가
hwpx를 렌더링해준다 — `navigate`로 열고 `computer` 스크린샷을 스크롤하며 읽는다
(`get_page_text`는 캔버스/이미지 렌더링이라 빈 문자열을 반환한다).

**⚠️ CSRF 폼 우회 팁 (17라운드, 강진군청)** — 검색 폼이 `csrf_token` 히든필드를
쓰면 `form.submit()`을 JS로 호출해도 요청이 안 나간다. 폼의 `action` URL에
`?query=검색어`를 붙여 직접 `navigate`하면 토큰 없이도 정상 동작한다 — 경남바로
서비스의 URL 파라미터 우회와 같은 계열.

**인천 —** 8개 구·군(중구·동구·영종구·제물포구·강화군·옹진군·서해구·검단구) 전수
완료 — 더 볼 곳 없음. 다만 팀 판단 필요 항목 남음: 인천청년포털에서 중구·동구·
서구가 완전히 사라지고 서해구·검단구로 대체됨 — 이미 등록된
`incheon-junggu-moving-cost-support`·`incheon-donggu-welcome-pay`의 regionScope
처리를 어떻게 할지(확인목록.md 14·17번). 2026-07-01 인천 행정체제 개편(중구·동구
폐지 → 제물포구·영종구, 서구 분구) 자체는 사실 확인됐지만 기존 등록 두 건이
개편 후에도 유효한지는 미해결 — 인천시 행정체제개편지원과 문의 필요.

**사실 확인 필요:**
- `gumi-youth-rent-support` 하반기 신청기간(9월말~10월초 예정, 정확한 날짜 미확인) — 확인목록.md 15번
- "전남광주통합특별시" 명칭 모호성(광주광역시와 실제 통합된 건지, 표기 전환 중인 건지) — 다음에 광주·전남 관련 정책을 더 볼 때 먼저 확인 필요
