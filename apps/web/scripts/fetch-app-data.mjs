// 빌드 전에 Supabase 에서 정책을 읽어 data/policies.json · loan-products.json · verification.json 을 다시 쓴다.
//
//   node scripts/fetch-app-data.mjs           # 키가 있으면 DB → 파일, 없으면 아무것도 안 하고 끝 (package.json prebuild)
//   node scripts/fetch-app-data.mjs --check   # 파일은 그대로 두고, DB 로 만든 결과와 커밋된 파일이 같은지만 본다
//
// 설계: docs/기획/2026-11-16-정책-Supabase-읽기-설계.md (A안 — 빌드할 때 읽기)
//
// 환경변수 (Vercel Production 에만 넣는다)
//   SUPABASE_URL              https://<프로젝트>.supabase.co
//   SUPABASE_PUBLISHABLE_KEY  sb_publishable_... — 공개 키다. 이 키로는 public.app_policies() 하나만 부를 수 있다(표는 RLS 로 닫힘)
//
// 키가 없으면(로컬 개발 · PR 검사 · 미리보기) 커밋된 파일을 그대로 쓴다.
// 키가 있는데 DB 가 응답하지 않거나 검사에 실패하면 빌드를 멈춘다 — 정식 앱은 직전 배포 그대로 남고,
// 옛 값으로 조용히 배포하지 않는다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatJson, toAppData } from "./app-data/from-db.mjs";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const FILES = { policies: "policies.json", loanProducts: "loan-products.json", verification: "verification.json" };
const check = process.argv.includes("--check");

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.log("[fetch-app-data] SUPABASE_URL · SUPABASE_PUBLISHABLE_KEY 가 없다 — 커밋된 data/*.json 을 그대로 쓴다");
  process.exit(check ? 1 : 0);
}

async function fetchRows(attempt = 1) {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/app_policies`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    console.log(`[fetch-app-data] ${attempt}번째 실패, 다시 시도: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2_000 * attempt));
    return fetchRows(attempt + 1);
  }
}

// 확인 시각은 한국 시간으로 적는다 (예전 SQL 스냅숏과 같은 모양)
const kstNow = () => new Date(Date.now() + 9 * 3600_000).toISOString().replace(/\.\d+Z$/, "+09:00");

let data;
try {
  data = toAppData(await fetchRows(), { generatedAt: kstNow() });
} catch (err) {
  console.error(`[fetch-app-data] 실패 — 빌드를 멈춘다\n${err.message}`);
  process.exit(1);
}

if (check) {
  // 확인 시각은 매번 다르므로 비교에서 뺀다
  const strip = (name, text) => (name === "verification" ? text.replace(/"generatedAt": "[^"]*"/, "") : text);
  const diff = Object.entries(FILES).filter(([name, file]) =>
    strip(name, readFileSync(join(DATA, file), "utf8")) !== strip(name, formatJson(data[name])));
  if (diff.length) {
    console.error(`[fetch-app-data] DB 와 다른 파일: ${diff.map(([, f]) => f).join(", ")}`);
    process.exit(1);
  }
  console.log("[fetch-app-data] 커밋된 data/*.json = DB");
  process.exit(0);
}

for (const [name, file] of Object.entries(FILES)) writeFileSync(join(DATA, file), formatJson(data[name]));
console.log(`[fetch-app-data] DB → 지원금 ${data.policies.length}건 · 안내 상품 ${data.loanProducts.length}건 · 검수 ${Object.keys(data.verification.policies).length}건`);
