#!/usr/bin/env node
/**
 * 온통청년 청년정책 API 에서 정책 원문 정보를 받아 두 개의 산출물을 만든다.
 *
 *   1) data/youth-policy-index.json   — 화면이 읽는 대조 색인 (policies.json 의 youthPolicyNo 기준)
 *   2) docs/기획/온통청년-주거후보.md  — 1층 정책을 8~12개로 늘릴 때 쓰는 후보 목록
 *
 * ── 왜 런타임이 아니라 빌드 전에 받아서 파일로 굽는가 ─────────────────────
 *
 *  - 앱은 `output: "export"` 정적 배포다. 런타임에 호출을 대신해 줄 서버가 없다.
 *  - 이 API 는 브라우저 직접 호출을 허용하지 않는다. Origin 을 붙여도
 *    Access-Control-Allow-Origin 이 오지 않고 OPTIONS 프리플라이트가 403 이다.
 *  - 인증키를 클라이언트 번들에 넣으면 누구나 볼 수 있다.
 *  - 같은 입력은 같은 결과를 내야 한다 (PRD F3-2). 화면이 매번 외부 응답에
 *    따라 달라지면 그 보장이 깨지고, 발표 중 API 가 죽으면 화면도 죽는다.
 *
 * 그래서 여기서 받은 값은 **판정과 금액 계산에 쓰지 않는다.** policies.json 이
 * 그대로 유일한 판정 근거이고, 이 색인은 "공식 등록 정보와 대조한 결과"를
 * 보여주는 용도로만 쓴다 (PRD 2-5 의 결정과 같다).
 *
 * 실행:
 *   npm run fetch:youth
 *
 * 인증키는 apps/web/.env.local 의 YOUTH_API_KEY 에서 읽는다 (.env* 는 gitignore 됨).
 * 환경변수로 직접 넘겨도 된다: YOUTH_API_KEY=... npm run fetch:youth
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

const API = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

/** 1층 발견 목록을 늘릴 때 훑을 범위. 익산 시군구 코드 + 주거 대분류. */
const DISCOVERY_QUERY = { lclsfNm: "주거", zipCd: "52140" };

// ── 인증키 ──────────────────────────────────────────────────────────────

function readApiKey() {
  if (process.env.YOUTH_API_KEY) return process.env.YOUTH_API_KEY.trim();
  // .env.local 을 직접 파싱한다. dotenv 를 의존성으로 추가하지 않기 위해서다.
  for (const name of [".env.local", ".env"]) {
    try {
      const text = readFileSync(join(WEB_ROOT, name), "utf8");
      const hit = text.match(/^\s*YOUTH_API_KEY\s*=\s*(.+)$/m);
      if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // 파일이 없으면 다음 후보로 넘어간다
    }
  }
  return null;
}

// ── API 호출 ────────────────────────────────────────────────────────────

async function callApi(key, params) {
  const url = new URL(API);
  url.searchParams.set("apiKeyNm", key);
  url.searchParams.set("rtnType", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  // 키가 틀리면 HTTP 200 에 errorCode 로 온다. 조용히 빈 결과로 넘기면 안 된다.
  if (body.errorCode) throw new Error(`${body.errorCode}: ${body.errorMsg}`);
  if (body.resultCode !== 200) throw new Error(`resultCode ${body.resultCode}: ${body.resultMessage}`);
  return body.result;
}

/** 화면에 쓰는 필드만 남긴다. 60개 필드를 통째로 커밋하면 뭐가 쓰이는지 알 수 없다. */
function pickRecord(p) {
  const emptyToNull = (v) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };
  return {
    plcyNo: p.plcyNo,
    name: emptyToNull(p.plcyNm),
    agency: emptyToNull(p.sprvsnInstCdNm) ?? emptyToNull(p.operInstCdNm),
    largeCategory: emptyToNull(p.lclsfNm),
    mediumCategory: emptyToNull(p.mclsfNm),
    applyPeriod: emptyToNull(p.aplyYmd), // "20260415 ~ 20260930" 형태
    applyUrl: emptyToNull(p.aplyUrlAddr),
    referenceUrl: emptyToNull(p.refUrlAddr1),
    ageMin: Number(p.sprtTrgtMinAge) || 0,
    ageMax: Number(p.sprtTrgtMaxAge) || 0,
    // Y = 나이 제한 없음. 0~0 과 구분해야 나이 대조를 헛돌리지 않는다.
    ageUnlimited: p.sprtTrgtAgeLmtYn === "Y",
    supportScale: Number(p.sprtSclCnt) || 0,
    firstComeFirstServed: p.sprtArvlSeqYn === "Y",
    lastModifiedAt: emptyToNull(p.lastMdfcnDt),
  };
}

// ── 앱 데이터와의 대조 ──────────────────────────────────────────────────

/** "20260415 ~ 20260930" → { start: "2026-04-15", end: "2026-09-30" } */
function parseApplyPeriod(raw) {
  if (!raw) return null;
  const dates = raw.match(/\d{8}/g);
  if (!dates || dates.length === 0) return null;
  const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return { start: iso(dates[0]), end: dates[1] ? iso(dates[1]) : null };
}

/**
 * 앱 데이터와 온통청년 등록 정보가 어긋나는 지점을 찾는다.
 * 여기서 나온 경고는 화면에 그대로 노출한다 — 숨기면 이 연동의 의미가 없다.
 */
function findMismatches(policy, record) {
  const out = [];
  const period = parseApplyPeriod(record.applyPeriod);

  if (period) {
    if (period.start !== policy.applicationStart) {
      out.push(`신청 시작일: 앱 ${policy.applicationStart} / 온통청년 ${period.start}`);
    }
    const appEnd = policy.applicationEnd ?? "상시(마감 없음)";
    const apiEnd = period.end ?? "종료일 미기재";
    if ((policy.applicationEnd ?? null) !== (period.end ?? null)) {
      out.push(`신청 종료일: 앱 ${appEnd} / 온통청년 ${apiEnd}`);
    }
  }

  if (!record.ageUnlimited && record.ageMax > 0) {
    const d = policy.discovery ?? {};
    if (record.ageMin !== d.ageMin || record.ageMax !== d.ageMax) {
      out.push(`나이 범위: 앱 ${d.ageMin}~${d.ageMax}세 / 온통청년 ${record.ageMin}~${record.ageMax}세`);
    }
  }

  if (record.name && record.name !== policy.name) {
    out.push(`정책명: 앱 "${policy.name}" / 온통청년 "${record.name}"`);
  }

  return out;
}

// ── 실행 ────────────────────────────────────────────────────────────────

const key = readApiKey();
if (!key) {
  console.error("YOUTH_API_KEY 가 없습니다.");
  console.error("apps/web/.env.local 에 YOUTH_API_KEY=<발급받은 키> 를 넣거나 환경변수로 넘기세요.");
  process.exit(1);
}

const policiesPath = join(WEB_ROOT, "data", "policies.json");
const policies = JSON.parse(readFileSync(policiesPath, "utf8"));
// toISOString() 은 UTC 라서 한국시간 오전 9시 전에는 날짜가 하루 밀린다.
// 조회일이 어제로 찍히면 "언제 확인한 데이터냐"가 어긋난다.
const today = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

// 1) 매핑된 정책을 하나씩 조회한다
const records = {};
const report = [];
let unregistered = 0;

for (const policy of policies) {
  if (!policy.youthPolicyNo) {
    unregistered++;
    report.push({ id: policy.id, state: "미등록", detail: "youthPolicyNo 가 null — 온통청년에서 찾지 못한 정책" });
    continue;
  }
  try {
    const result = await callApi(key, { plcyNo: policy.youthPolicyNo, pageNum: 1, pageSize: 5 });
    const hit = (result.youthPolicyList ?? []).find((p) => p.plcyNo === policy.youthPolicyNo);
    if (!hit) {
      report.push({ id: policy.id, state: "조회 실패", detail: `plcyNo ${policy.youthPolicyNo} 응답에 없음` });
      continue;
    }
    const record = pickRecord(hit);
    record.mismatches = findMismatches(policy, record);
    records[policy.youthPolicyNo] = record;
    report.push({
      id: policy.id,
      state: record.mismatches.length > 0 ? `불일치 ${record.mismatches.length}건` : "일치",
      detail: record.mismatches.join(" | ") || record.name,
    });
  } catch (err) {
    report.push({ id: policy.id, state: "오류", detail: err.message });
  }
}

const index = {
  source: "온통청년 청년정책 API (getPlcy)",
  sourceUrl: "https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide",
  fetchedAt: today,
  note: "이 파일은 scripts/fetch-youth-policies.mjs 가 생성한다. 손으로 고치지 말 것. 판정·금액 계산에는 쓰지 않는다.",
  records,
};
writeFileSync(join(WEB_ROOT, "data", "youth-policy-index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");

// 2) 1층 확장용 후보 목록
let candidateMd = "";
try {
  const pool = await callApi(key, { ...DISCOVERY_QUERY, pageNum: 1, pageSize: 100 });
  const mapped = new Set(policies.map((p) => p.youthPolicyNo).filter(Boolean));
  const rows = (pool.youthPolicyList ?? []).map(pickRecord);

  const line = (r) =>
    `| ${r.name ?? "-"} | ${r.agency ?? "-"} | ${r.mediumCategory ?? "-"} | ${r.applyPeriod ?? "미기재"} | ` +
    `${r.ageUnlimited ? "제한없음" : `${r.ageMin}~${r.ageMax}`} | ${r.supportScale || "-"}${r.firstComeFirstServed ? " (선착순)" : ""} | ` +
    `${r.applyUrl ? `[링크](${r.applyUrl})` : "없음"} | ${r.lastModifiedAt?.slice(0, 10) ?? "-"} | \`${r.plcyNo}\` |`;

  const header =
    "| 정책명 | 주관기관 | 중분류 | 신청기간 | 나이 | 규모 | 신청URL | 최종수정 | plcyNo |\n" +
    "|---|---|---|---|---|---|---|---|---|";

  const fresh = rows.filter((r) => !mapped.has(r.plcyNo));
  const already = rows.filter((r) => mapped.has(r.plcyNo));

  candidateMd =
    `# 온통청년 주거 정책 후보 (익산 기준)\n\n` +
    `> 자동 생성 — \`npm run fetch:youth\` 로 갱신한다. 조회일 **${today}**\n` +
    `> 조회 조건: 대분류 \`주거\` + 시군구코드 \`52140\` (전북특별자치도 익산시), 총 ${rows.length}건\n\n` +
    `PRD 3-2 의 1층 목표는 정책 **8~12개**다. 현재 \`policies.json\` 에 ${policies.length}개가 있다.\n` +
    `아래에서 현금성 주거 지원금만 골라 공고 원문을 확인한 뒤 추가한다.\n\n` +
    `> [!WARNING]\n` +
    `> 이 목록은 후보일 뿐이다. 지역 코드로 걸렀는데도 다른 시·도 사업이 섞여 들어오고,\n` +
    `> 사업 계획(예: "주거포털 개선")처럼 개인이 신청할 수 없는 항목도 포함된다.\n` +
    `> 반드시 공고 원문을 열어 확인하고, \`verifiedAt\` 을 채운 뒤 \`policies.json\` 에 넣는다.\n\n` +
    `## 아직 앱에 없는 후보 (${fresh.length}건)\n\n${header}\n${fresh.map(line).join("\n")}\n\n` +
    `## 이미 앱에 매핑된 정책 (${already.length}건)\n\n${header}\n${already.map(line).join("\n")}\n`;

  const outDir = join(REPO_ROOT, "docs", "기획");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "온통청년-주거후보.md"), candidateMd, "utf8");
} catch (err) {
  console.error(`후보 목록 조회 실패 (색인은 정상 생성됨): ${err.message}`);
}

// ── 사람이 읽는 보고 ────────────────────────────────────────────────────

console.log(`\n온통청년 대조 결과 (조회일 ${today})\n`);
for (const r of report) {
  console.log(`  ${r.state.padEnd(10)} ${r.id}`);
  if (r.detail) console.log(`             ${r.detail}`);
}
console.log(`\n  data/youth-policy-index.json — ${Object.keys(records).length}건 기록, 미등록 ${unregistered}건`);
if (candidateMd) console.log(`  docs/기획/온통청년-주거후보.md — 후보 목록 갱신됨`);
console.log("");
