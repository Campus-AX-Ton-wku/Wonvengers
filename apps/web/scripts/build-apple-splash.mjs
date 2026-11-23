// 아이폰 시작 이미지를 기종별로 굽는다 (docs/기획/2026-11-20-앱-시작-화면-설계.md "아이폰 시작 이미지").
//
//   node scripts/build-apple-splash.mjs
//
// 웹 스플래시(app/globals.css #splash)와 같은 한 장 — 파랑 #1a6bef 바탕, 가운데에서 화면 높이 4% 위로 올린 앱 아이콘 150px — 을 기종 화면 크기 그대로 찍는다.
// 아이콘(app/icon.png)이 바뀌면 다시 돌린다. 기종 목록은 lib/apple-splash.json (layout 의 <link> 와 같은 목록).
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB = fileURLToPath(new URL("../", import.meta.url));
const devices = JSON.parse(readFileSync(`${WEB}lib/apple-splash.json`, "utf8"));
const icon = `data:image/png;base64,${readFileSync(`${WEB}app/icon.png`).toString("base64")}`;
const OUT = `${WEB}public/splash/`;
mkdirSync(OUT, { recursive: true });

const html = `<!doctype html><html><body style="margin:0;height:100vh;background:#1a6bef;display:flex;align-items:center;justify-content:center">
<img src="${icon}" width="150" height="150" style="display:block;transform:translateY(-4vh)"></body></html>`;

const browser = await chromium.launch();
for (const { w, h, dpr } of devices) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(html);
  await page.locator("img").evaluate((img) => img.decode());
  const file = `apple-splash-${w * dpr}x${h * dpr}.png`;
  await page.screenshot({ path: `${OUT}${file}` });
  await page.close();
  console.log(file);
}
await browser.close();
