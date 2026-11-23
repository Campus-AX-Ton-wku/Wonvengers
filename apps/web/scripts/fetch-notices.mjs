// 빌드 전에 익산 청약 공고를 받아 data/notices.json 을 다시 쓴다.
//
//   node scripts/fetch-notices.mjs   # 키가 있으면 받아서 쓰고, 없거나 실패하면 커밋된 파일 그대로
//
// 설계: docs/기획/2026-11-22-청약-공고-설계.md §1
// 환경변수(또는 apps/web/.env.local): BOJOGEUM_KEY(공공데이터포털 일반 인증키 — 마이홈 · 청약홈 활용신청 11/22 승인)
// 빌드를 멈추지 않는다 — 공고가 하루 늦는 것이 배포가 멈추는 것보다 낫다. 한 목록이라도 실패하면 덮어쓰지 않는다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectNotices, formatSnapshot } from "./notices/build.mjs";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB_ROOT, "data", "notices.json");
const log = (m) => console.log(`[fetch-notices] ${m}`);

function readKey(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  for (const file of [".env.local", ".env"]) {
    try {
      const hit = readFileSync(join(WEB_ROOT, file), "utf8").match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
      if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // 파일이 없으면 다음 후보로
    }
  }
  return null;
}

const deadline = AbortSignal.timeout(90_000);

/** 주소(키가 든 URL)를 오류 문구에 싣지 않는다 */
async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(15_000), deadline]) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (deadline.aborted || attempt >= 3) throw new Error(err?.message ?? "요청 실패");
    await new Promise((r) => setTimeout(r, 1_500 * attempt));
    return fetchJson(url, attempt + 1);
  }
}

const kstNow = () => new Date(Date.now() + 9 * 3_600_000).toISOString().replace(/\.\d+Z$/, "+09:00");

async function main() {
  if (process.env.VERCEL_ENV === "preview") return log("미리보기 빌드 — 받지 않고 커밋된 data/notices.json 을 그대로 쓴다");
  const key = readKey("BOJOGEUM_KEY");
  if (!key) return log("BOJOGEUM_KEY 가 없다 — 커밋된 data/notices.json 을 그대로 쓴다");
  try {
    const now = kstNow();
    const notices = await collectNotices({ fetchJson, key, today: now.slice(0, 10) });
    writeFileSync(OUT, formatSnapshot(notices, now));
    log(`익산 공고 ${notices.length}건 — ${Object.entries(Object.groupBy(notices, (n) => n.kind)).map(([k, v]) => `${k} ${v.length}`).join(" · ") || "없음"}`);
  } catch (err) {
    log(`받지 못했다(${err.message}) — 커밋된 data/notices.json 을 그대로 쓴다`);
  }
}

await main();
