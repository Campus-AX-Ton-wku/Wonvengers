/**
 * 뒤로가기 재현 시나리오 — docs/기획/2026-11-03-단계-이동-설계.md "왜" 의 표(A·B·C)와
 * "결과에서 화살표로 끝까지(D)" 를 정적 export(`out/`) 위에서 돌린다.
 *
 *   npm run build && node scripts/check-back-nav.mjs
 *
 * 시나리오마다 새 브라우저 컨텍스트로 시작한다 = 처음 접속한 사람(온보딩부터).
 * 앱보다 먼저 `/__outside` 를 열어 둔다. 앱 밖으로 나가면 그 주소가 보여서 "앱 밖" 을
 * 판정할 수 있다(빈 탭의 about:blank 는 첫 이동에 덮여 기록에 남지 않는다).
 *
 * 하나라도 기대와 다르면 exit 1. dev 서버가 아니라 out/ 를 쓰는 이유는 shoot.mjs 머리말과 같다.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../out/", import.meta.url).pathname;
const PORT = 4322; // shoot.mjs(4321)와 동시에 돌려도 부딪히지 않게
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUTSIDE = "/__outside";

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

/** 정적 export 는 `/find` 를 `find.html` 로 굽는다. 후보를 차례로 시도한다 (shoot.mjs 와 같다). */
async function resolve(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const file = join(ROOT, candidate);
    if (!file.startsWith(ROOT)) continue;
    if (existsSync(file) && extname(file)) return file;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  if (pathname === OUTSIDE) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end('<!doctype html><meta charset="utf-8"><title>앱 밖</title><p>앱 밖</p>');
    return;
  }
  const file = await resolve(pathname);
  if (!file) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
});

/** 지금 어디인가. 질문 화면은 단계 주소까지, 그 밖은 경로만. */
function where(page) {
  const url = new URL(page.url());
  if (url.origin !== ORIGIN || url.pathname === OUTSIDE) return "앱 밖";
  const q = url.searchParams.get("q");
  if (!q) return url.pathname;
  const p = url.searchParams.get("p");
  return `${url.pathname}?q=${q}${p ? `&p=${p}` : ""}`;
}

/** 클라이언트 이동(push·replace·popstate)이 화면에 반영될 때까지. */
async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

async function press(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  await settle(page);
}

const arrow = (page) => press(page, "이전 단계로");

async function browserBack(page) {
  await page.goBack();
  await settle(page);
}

/** 처음 접속 → 온보딩 3장 → /find?q=birth */
async function enter(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    locale: "ko-KR",
  });
  const page = await context.newPage();
  await page.goto(ORIGIN + OUTSIDE);
  // layout 의 <head> 스크립트가 "/" 를 /onboarding 으로 location.replace 한다.
  await page.goto(`${ORIGIN}/`, { waitUntil: "commit" });
  await page.waitForURL("**/onboarding", { waitUntil: "networkidle" });
  await settle(page);
  await press(page, "다음");
  await press(page, "다음");
  await press(page, "내 혜택 찾아보기");
  await page.waitForURL(/\/find\?q=birth$/);
  await settle(page);
  return { context, page };
}

/** 질문에 차례로 답한다. stopAt 이 "status" 면 현재 상태 질문에서 멈춘다. 아니면 /find/result 까지. */
async function answer(page, stopAt) {
  // 아직 안 고른 사람에게는 휠이 펼쳐져 있다. '확인' 은 휠이 가리키는 날짜(만 18세 생일)를 올린다.
  await press(page, "확인");
  await press(page, "다음"); // ?q=region
  await press(page, "전북특별자치도"); // ?q=region&p=전북특별자치도
  await press(page, "익산시");
  await press(page, "다음"); // ?q=status
  if (stopAt === "status") return;
  await press(page, "대학생");
  await press(page, "다음"); // ?q=income
  await press(page, "월 100만원 이하");
  await press(page, "다음"); // ?q=housing
  await press(page, "월세");
  await press(page, "다음");
  await page.waitForURL("**/find/result");
  await settle(page);
}

const 지역목록 = "/find?q=region&p=전북특별자치도";

const SCENARIOS = [
  {
    id: "A",
    action: "질문 도중(현재 상태) 브라우저 뒤로가기",
    expected: [지역목록],
    async run(page) {
      await answer(page, "status");
      await browserBack(page);
      return [where(page)];
    },
  },
  {
    id: "A′",
    action: "질문 도중(현재 상태) 왼쪽 위 화살표",
    expected: [지역목록],
    async run(page) {
      await answer(page, "status");
      await arrow(page);
      return [where(page)];
    },
  },
  {
    id: "B",
    action: "결과에서 브라우저 뒤로가기 두 번",
    expected: ["/find?q=housing", "/find?q=income"],
    async run(page) {
      await answer(page);
      const seen = [];
      await browserBack(page);
      seen.push(where(page));
      await browserBack(page);
      seen.push(where(page));
      return seen;
    },
  },
  {
    id: "C",
    action: "결과에서 화살표 → 브라우저 뒤로가기",
    expected: ["/find?q=housing", "/find?q=income"],
    async run(page) {
      await answer(page);
      const seen = [];
      await arrow(page);
      seen.push(where(page));
      await browserBack(page);
      seen.push(where(page));
      return seen;
    },
  },
  {
    id: "D",
    action: "결과에서 화살표로 끝까지, 그다음 브라우저 뒤로가기",
    expected: [
      "/find?q=housing",
      "/find?q=income",
      "/find?q=status",
      지역목록,
      "/find?q=region",
      "/find?q=birth",
      "/", // 첫 질문이 이 탭의 첫 화면이라 화살표가 랜딩으로 replace 한다
      "앱 밖", // 맨 처음 화면에서만 앱 밖으로 나간다
    ],
    async run(page) {
      await answer(page);
      const seen = [];
      for (let i = 0; i < 7; i++) {
        await arrow(page);
        seen.push(where(page));
      }
      await browserBack(page);
      seen.push(where(page));
      return seen;
    },
  },
];

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch();
const rows = [];
let failed = 0;

for (const scenario of SCENARIOS) {
  let actual;
  let context;
  try {
    const entered = await enter(browser);
    context = entered.context;
    actual = await scenario.run(entered.page);
  } catch (err) {
    actual = [`오류: ${String(err.message ?? err).split("\n")[0]}`];
  }
  await context?.close();
  const ok =
    actual.length === scenario.expected.length && actual.every((v, i) => v === scenario.expected[i]);
  if (!ok) failed++;
  rows.push({
    시나리오: scenario.id,
    동작: scenario.action,
    기대: scenario.expected.join(" → "),
    실제: actual.join(" → "),
    결과: ok ? "OK" : "FAIL",
  });
}

await browser.close();
server.close();

console.table(rows);
if (failed > 0) {
  console.error(`${failed}개 시나리오가 기대와 다르다`);
  process.exit(1);
}
console.log("모든 시나리오가 기대와 같다");
