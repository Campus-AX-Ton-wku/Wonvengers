/**
 * 덱에 실리는 화면을 자동으로 캡처한다 (docs/발표/build-ir-deck.py 가 이 이미지를 읽는다).
 *
 * ── 왜 스크립트인가 ────────────────────────────────────────────────
 *
 * 손으로 찍으면 매번 답변을 다시 고르고, 스크롤 위치와 기기 폭이 조금씩 달라진다.
 * 그러면 덱 세 장의 여백과 글씨 크기가 서로 안 맞는다. 더 나쁜 것은 재현이
 * 안 되는 것이다 — 화면을 고친 뒤 "고쳐진 화면"을 다시 찍으려면 같은 상태를
 * 손으로 복원해야 한다. landing.png 가 랜딩 개편 전 캡처로 남아 덱에서 빠진 게
 * 그 결과다.
 *
 * ── 규격 ──────────────────────────────────────────────────────────
 *
 * 기존 캡처가 780 x 1688 이다. iPhone 뷰포트(390 x 844)의 2배이므로 그 조합을
 * 그대로 쓴다. 폭이 바뀌면 덱 슬라이드의 이미지 자리가 어긋난다.
 *
 * ── 화면 상태 ──────────────────────────────────────────────────────
 *
 * /find/policies 와 /result 는 localStorage 를 읽고 나서야 카드와 금액을 그린다.
 * 그래서 페이지가 뜨기 전에 addInitScript 로 값을 넣는다 (앱의 useEffect 보다 먼저).
 * 키는 lib/storage.ts 의 것을 그대로 쓴다 — 저쪽이 바뀌면 여기도 깨져야 한다.
 *
 * 아래 FIXTURE 는 발표용 가상 조건이다. data/example-listings.json 의
 * '익산 원룸 · 연세' 를 기준으로, 이사비 정책이 상한에 걸리는 것을 보여주도록
 * oneTimeMoveCost 를 얹었다. 값을 바꾸면 덱의 숫자가 바뀐다.
 */

/*
 * ── 실행 준비 ──────────────────────────────────────────────────────
 *
 *   npm run dev                            # 다른 창에서 서버를 띄워둔다
 *   node scripts/capture-screens.mjs       # docs/이미지/ 에 4장을 덮어쓴다
 *   CAPTURE_OUT=/tmp/shots node ...        # 덮어쓰기 전에 눈으로 볼 때
 *
 * **주의 1 — 시스템에 한글 폰트를 깔지 말 것.** 역설적으로 들리지만 의도한
 * 것이다. 앱은 Pretendard 를 웹폰트로 직접 싣는다(app/layout.tsx). 캡처 환경에
 * 시스템 한글 폰트가 없으면, 웹폰트가 깨진 날 캡처가 두부(□)로 즉시 알려준다.
 * 시스템에 Pretendard 를 깔아두면 웹폰트가 죽어도 똑같이 예쁘게 찍혀서
 * 사용자만 깨진 화면을 보게 된다 — 실제로 이 함정에 한 번 빠졌다.
 *
 * 이모지는 별도 폰트가 필요하다 (fonts-noto-color-emoji) — 없으면 섹션 제목의
 * 🧩·💳 가 두부가 된다. 이모지는 서브셋에 넣지 않으므로 이건 기기 폰트가 맞다.
 *
 * **WSL 주의 2 — HMR 이 안 돈다.** /mnt/c (윈도우 파일시스템)에서는 inotify 가
 * 동작하지 않아 Next dev 가 파일 변경을 못 잡는다. 코드를 고친 뒤 그냥 찍으면
 * **낡은 화면이 조용히 찍힌다.** 서버를 폴링으로 띄우거나 재시작할 것:
 *
 *   WATCHPACK_POLLING=true npm run dev
 */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
/* 기본값은 덱이 읽는 자리다. 커밋된 캡처를 덮기 전에 눈으로 보고 싶으면
   CAPTURE_OUT 으로 다른 폴더에 찍는다. */
const SHOTS = process.env.CAPTURE_OUT
  ? resolve(process.env.CAPTURE_OUT)
  : resolve(HERE, "../../../docs/이미지");
const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";

/* lib/storage.ts 의 키. 저쪽 상수와 어긋나면 화면이 빈 상태로 찍힌다. */
const KEYS = {
  answers: "perky.answers",
  listing: "housing-benefit:listing",
  profile: "housing-benefit:profile",
};

const FIXTURE = {
  /* 1층 답변 — policies.png 의 요약 칩이 이 값으로 그려진다. */
  answers: {
    // 1월 1일생이라 그해 내내 만 24세로 잡힌다 (2026년 기준). 캡처마다 나이가
    // 흔들리지 않도록 생일이 이미 지난 날짜로 둔다.
    birthDate: "2002-01-01",
    region: "전북특별자치도 익산시",
    status: "대학생",
    incomeBracket: 2, // 월 100~150만원
  },

  /* 계약 조건 — '익산 원룸 · 연세' 예시 + 이사비 60만원.
     연세 480만원 ÷ 12개월 = 월 환산 40만원이라 월세 상한 20만원 정책에서
     캡핑이 걸린다. 이사비는 실지출 60만 > 상한 50만이라 상한으로 잘린다. */
  listing: {
    region: "전북특별자치도 익산시",
    contractType: "연세",
    deposit: 3000000,
    rentOrYearlyAmount: 4800000,
    managementFee: 30000,
    oneTimeMoveCost: 600000,
    contractStartDate: "2026-09-01",
    months: 12,
    sourceType: "예시 데이터",
    confirmedMatchesActualContract: true,
    exampleId: "iksan-oneroom-yearly",
  },

  /* 판정 문항 16개. 모두 채워야 결과가 '확인 필요' 로 덮이지 않는다.
     값은 lib/__tests__/fixtures.ts 의 makeProfile 과 같게 둔다 — 테스트가 보는
     상태와 캡처에 찍히는 상태가 갈리면, 통과한 테스트가 캡처를 보증하지 못한다.
     (isStudentOrEmployed 는 boolean 이 아니라 "student" 다.) */
  profile: {
    birthDate: "2003-08-12",
    isStudentOrEmployed: "student",
    livesApartFromParents: true,
    canRegisterResidence: true,
    hasNoHouse: true,
    isContractHolder: true,
    householdSize: 1,
    useOriginHousehold: true,
    ownHouseholdMonthlyIncome: 1000000,
    originHouseholdMonthlyIncome: 1000000,
    assetsUnder107M: true,
    isBasicLivelihoodRecipient: false,
    isNearPovertyClass: false,
    receivingOtherRentSupport: false,
    jeonbukResidentOverOneYear: true,
    employedInTargetSectorOver3Months: true,
  },
};

/* 덱이 읽는 세 장(find·policies·result)과, 개편된 랜딩까지 함께 찍는다.
   landing 은 현재 덱에서 빠져 있지만 찍어두면 되살릴 수 있다. */
const SCREENS = [
  { file: "landing.png", path: "/", wait: "Perky" },
  { file: "find.png", path: "/find", wait: "내 지원금 찾기" },
  { file: "policies.png", path: "/find/policies", wait: "지원금" },
  { file: "result.png", path: "/result", wait: "최대 지원 가능액" },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
    /* 애니메이션(rise-in, amount-in, stagger-in)이 도중에 찍히면 요소가 흐리거나
       어긋난 채로 남는다. reduced motion 이면 globals.css 가 애니메이션을 끈다. */
    reducedMotion: "reduce",
  });

  await context.addInitScript(
    ([keys, fixture]) => {
      localStorage.setItem(keys.answers, JSON.stringify(fixture.answers));
      localStorage.setItem(keys.listing, JSON.stringify(fixture.listing));
      localStorage.setItem(keys.profile, JSON.stringify(fixture.profile));
    },
    [KEYS, FIXTURE]
  );

  const page = await context.newPage();
  const failures = [];

  for (const screen of SCREENS) {
    const url = `${BASE}${screen.path}`;
    await page.goto(url, { waitUntil: "networkidle" });

    /* Next 개발 서버가 좌하단에 띄우는 표시가 캡처에 함께 찍힌다.
       next.config 로 끄면 팀 전체의 개발 환경이 바뀌므로 캡처할 때만 감춘다. */
    await page.addStyleTag({
      content: "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important }",
    });

    /* 문구가 나타날 때까지 기다린다. '불러오는 중...' 상태로 찍히면 빈 화면이 된다. */
    try {
      await page.getByText(screen.wait, { exact: false }).first().waitFor({ timeout: 10000 });
    } catch {
      failures.push(`${screen.file}: "${screen.wait}" 를 찾지 못했다 (${url})`);
      continue;
    }

    const out = resolve(SHOTS, screen.file);
    await page.screenshot({ path: out });
    console.log(`✓ ${screen.file.padEnd(14)} ${screen.path}`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("\n찍지 못한 화면:");
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n${SCREENS.length}장을 ${SHOTS} 에 덮어썼다.`);
  console.log("덱에 반영: cd docs/발표 && python3 build-ir-deck.py");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
