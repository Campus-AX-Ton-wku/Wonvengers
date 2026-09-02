/**
 * 리디자인 시각 검증 — 정적 export(`out/`)를 띄우고 주요 화면을 캡처한다.
 *
 * dev 서버를 쓰지 않는 이유: 이 저장소는 `/mnt/c`(윈도우 파일시스템)에 있어서
 * WSL 로 inotify 이벤트가 오지 않는다. Fast Refresh 가 죽어 있어 고친 코드가
 * 화면에 반영되지 않고, 그걸 모르고 "안 고쳐졌다"고 오판하게 된다.
 * 빌드 산출물을 그대로 띄우면 그 함정이 없고 프로덕션과 같은 것을 본다.
 *
 *   npm run build && node scripts/shoot.mjs
 *
 * 캡처는 .impeccable/review/ 로 나간다.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../out/", import.meta.url).pathname;
const OUT = new URL("../../../.impeccable/review/", import.meta.url).pathname;
const PORT = 4321;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

/** 정적 export 는 `/find` 를 `find.html` 로 굽는다. 후보를 차례로 시도한다. */
async function resolve(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(ROOT, candidate);
    if (!file.startsWith(ROOT)) continue;
    if (existsSync(file) && extname(file)) {
      return file;
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolve(new URL(req.url, "http://x").pathname);
  if (!file) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
});

/* 저장된 답변이 있어야 결과·목록 화면이 그려진다. 값은 lib/__tests__/fixtures.ts 와 같다. */
const SEED = {
  "perky.onboarded": "1",
  "perky.answers": JSON.stringify({
    birthDate: "2003-08-12",
    region: "전북특별자치도 익산시",
    status: "대학생",
    incomeBracket: 1,
    housingType: "월세",
  }),
  "perky.answered": JSON.stringify([
    "birthDate",
    "region",
    "status",
    "incomeBracket",
    "housingType",
  ]),
  "housing-benefit:listing": JSON.stringify({
    region: "전북특별자치도 익산시",
    contractType: "월세",
    deposit: 3000000,
    rentOrYearlyAmount: 400000,
    managementFee: 50000,
    oneTimeMoveCost: 600000,
    contractStartDate: "2026-10-01",
    months: 12,
    sourceType: "중개사 안내",
    confirmedMatchesActualContract: true,
    exampleId: null,
  }),
  "housing-benefit:profile": JSON.stringify({
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
  }),
};

/** 온보딩만 첫 방문 상태로 본다. */
const SHOTS = [
  { name: "mobile-onboarding-1", path: "/onboarding", fresh: true },
  { name: "mobile-onboarding-2", path: "/onboarding", fresh: true, click: "2단계" },
  { name: "mobile-onboarding-3", path: "/onboarding", fresh: true, click: "3단계" },
  { name: "mobile-landing", path: "/" },
  { name: "mobile-find", path: "/find" },
  { name: "mobile-find-result", path: "/find/result" },
  { name: "mobile-find-policies", path: "/find/policies", full: true },
  {
    name: "mobile-policy-detail",
    path: "/find/policies/iksan-newcomer-moving-cost-support",
    full: true,
  },
  {
    name: "mobile-policy-prepare",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    full: true,
  },
  {
    name: "mobile-policy-handoff",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    click: "공식 신청 사이트로 이동",
    full: true,
  },
  { name: "mobile-calculate", path: "/calculate", full: true },
  { name: "mobile-eligibility", path: "/eligibility", full: true },
  { name: "mobile-result", path: "/result", full: true },
];

const DESKTOP_SHOTS = [
  { name: "desktop-landing", path: "/" },
  { name: "desktop-find-policies", path: "/find/policies", full: true },
  {
    name: "desktop-policy-detail",
    path: "/find/policies/iksan-newcomer-moving-cost-support",
    full: true,
  },
  {
    name: "desktop-policy-prepare",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    full: true,
  },
  {
    name: "desktop-policy-handoff",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    click: "공식 신청 사이트로 이동",
    full: true,
  },
  { name: "desktop-result", path: "/result", full: true },
];

const NARROW_SHOTS = [
  { name: "narrow-landing", path: "/" },
  { name: "narrow-find-policies", path: "/find/policies", full: true },
  {
    name: "narrow-policy-detail",
    path: "/find/policies/iksan-newcomer-moving-cost-support",
    full: true,
  },
  {
    name: "narrow-policy-prepare",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    full: true,
  },
  {
    name: "narrow-policy-handoff",
    path: "/find/policies/iksan-newcomer-moving-cost-support/prepare",
    click: "공식 신청 사이트로 이동",
    full: true,
  },
  { name: "narrow-result", path: "/result", full: true },
];

async function capture(browser, viewport, shots, overflowReport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    /* 등장 애니메이션이 끝나지 않은 순간을 찍으면 "요소가 없다"로 오독한다.
       모션을 끄면 최종 상태가 즉시 보인다 (globals.css 의 reduced-motion 경로). */
    reducedMotion: "reduce",
    locale: "ko-KR",
  });

  for (const shot of shots) {
    const page = await context.newPage();
    if (!shot.fresh) {
      await page.addInitScript((seed) => {
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      }, SEED);
    }
    await page.goto(`http://127.0.0.1:${PORT}${shot.path}`, { waitUntil: "networkidle" });
    if (shot.click) {
      await page.getByRole("button", { name: new RegExp(shot.click) }).click();
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    // 가로 스크롤이 생기는지. 320px 에서 지면을 뚫는 요소를 잡는 것이 목적이다.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      culprits: [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
    }));
    if (overflow.scrollWidth > overflow.clientWidth) {
      overflowReport.push(`${shot.name}: ${overflow.scrollWidth}>${overflow.clientWidth} ${overflow.culprits.join(" | ")}`);
    }

    await page.screenshot({ path: join(OUT, `${shot.name}.png`), fullPage: shot.full === true });
    await page.close();
  }
  await context.close();
}

mkdirSync(OUT, { recursive: true });
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch();
const overflowReport = [];
await capture(browser, { width: 390, height: 844 }, SHOTS, overflowReport);
await capture(browser, { width: 1280, height: 900 }, DESKTOP_SHOTS, overflowReport);
await capture(browser, { width: 320, height: 640 }, NARROW_SHOTS, overflowReport);
await browser.close();
server.close();

console.log(overflowReport.length ? `가로 넘침:\n  ${overflowReport.join("\n  ")}` : "가로 넘침 없음");
console.log(`캡처 완료 → ${OUT}`);
