#!/usr/bin/env node
/**
 * 정책 데이터 신선도 감지 — 주 1회 자동 실행 (.github/workflows/policy-freshness.yml).
 *
 * **이 스크립트는 policies.json 을 고치지 않는다.** 어긋난 곳을 찾아 사람에게
 * 넘길 뿐이다. 왜 자동 반영을 안 하는지는 2026-08-30 spike 에서 확인했다.
 *
 *  - 판정에 쓰는 값(monthlyCap·maxMonths·requiredInputs·소득기준)은 어느 API 에도 없다.
 *    사람이 공고 원문을 읽어야만 나오는 값이다.
 *  - 상류가 앱보다 낡는다. 보조금24 는 전국 청년월세 신청기한을 "2026년 상반기"라
 *    적고 있지만 실제 접수는 3/30~5/29 로 이미 끝났고, 그건 앱이 맞게 갖고 있다.
 *    무인 반영은 맞는 값을 틀린 값으로 덮어쓴다.
 *  - verifiedAt 은 "팀이 공고 원문과 대조한 날짜"라는 뜻이다. 기계가 값을 바꾸면
 *    이 날짜가 거짓말이 된다.
 *
 * 하는 일은 세 가지다.
 *
 *   1) 3자 대조 — 앱 · 온통청년 · 보조금24. 2자 대조는 어긋남을 찾아도 어느 쪽이
 *      낡았는지 모른다. 3자면 앱이 혼자 튀는지 바깥이 튀는지로 우선순위가 갈린다.
 *   2) 익산 주거 목록 감시 — 보조금24 는 지역 필터가 정확하다(온통청년은 깨져 있다).
 *      새 사업이 등록되거나 기존 사업 원문이 바뀌면 잡는다. 자유 서술 텍스트는
 *      파싱하지 않고 지문만 비교한다.
 *   3) verifiedAt 낡음 — 대조한 지 오래된 정책을 그냥 알려준다.
 *
 * 종료 코드: 0 = 검토할 것 없음, 10 = 검토 필요, 1 = 실행 실패.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareField, normalizeName } from "./freshness/compare.mjs";
import { diffSnapshots, fingerprintRecord } from "./freshness/snapshot.mjs";
import { withRetry } from "./freshness/retry.mjs";
import { fromGov24, fromYouth } from "./freshness/sources.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, "..");
const SNAPSHOT_PATH = join(HERE, "freshness", "iksan-snapshot.json");
const REPORT_PATH = process.env.FRESHNESS_REPORT ?? join(WEB_ROOT, "freshness-report.md");

/** 팀이 공고를 다시 볼 때가 됐다고 보는 간격. 접수는 수시로 바뀐다. */
const STALE_DAYS = 90;

/** 보조금24 에서 익산 주거를 훑는 조건. 지역은 소관기관명에 실려 온다. */
const IKSAN_QUERY = { "cond[소관기관명::LIKE]": "익산", "cond[서비스분야::LIKE]": "주거" };

// ── 인증키 ──────────────────────────────────────────────────────────────

/** .env.local 을 직접 읽는다. dotenv 를 의존성으로 들이지 않기 위해서다. */
function readKey(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  for (const file of [".env.local", ".env"]) {
    try {
      const hit = readFileSync(join(WEB_ROOT, file), "utf8").match(
        new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m")
      );
      if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // 파일이 없으면 다음 후보로
    }
  }
  return null;
}

const YOUTH_KEY = readKey("YOUTH_API_KEY");
const GOV24_KEY = readKey("BOJOGEUM_KEY");

// ── 소스 호출 ───────────────────────────────────────────────────────────

async function callYouth(params) {
  return withRetry(() => callYouthOnce(params));
}

async function callYouthOnce(params) {
  const url = new URL("https://www.youthcenter.go.kr/go/ythip/getPlcy");
  url.searchParams.set("apiKeyNm", YOUTH_KEY);
  url.searchParams.set("rtnType", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  // 키가 틀리면 HTTP 200 에 errorCode 로 온다. 조용히 빈 결과로 넘기면 안 된다.
  if (body.errorCode) throw new Error(`${body.errorCode}: ${body.errorMsg}`);
  return body.result;
}

async function callGov24(params) {
  return withRetry(() => callGov24Once(params));
}

async function callGov24Once(params) {
  const url = new URL("https://api.odcloud.kr/api/gov24/v3/serviceList");
  url.searchParams.set("serviceKey", GOV24_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ── 날짜 ────────────────────────────────────────────────────────────────

/** toISOString() 은 UTC 라 한국시간 오전 9시 전에는 날짜가 하루 밀린다. */
function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(fromISO, toISO) {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

// ── 1) 3자 대조 ─────────────────────────────────────────────────────────

/** 대조할 필드. 값을 못 말하는 소스는 sources.mjs 가 null 로 준다. */
const FIELDS = [
  { field: "정책명", pick: (s) => s.name, normalize: normalizeName },
  { field: "신청시작일", pick: (s) => s.applicationStart },
  { field: "신청종료일", pick: (s) => s.applicationEnd },
  { field: "지원 최소나이", pick: (s) => s.ageMin },
  { field: "지원 최대나이", pick: (s) => s.ageMax },
];

async function 대조(policy) {
  const 결과 = { id: policy.id, name: policy.name, 조회실패: [], 건너뜀: [], 필드: [] };

  // 못 본 이유를 구분한다. "키가 없어서"와 "매핑이 없어서"는 다음에 할 일이 다르다.
  for (const [소스, 키, 번호] of [
    ["온통청년", YOUTH_KEY, policy.youthPolicyNo],
    ["보조금24", GOV24_KEY, policy.gov24ServiceId],
  ]) {
    if (!키) 결과.건너뜀.push(`${소스}: 인증키 없음`);
    else if (!번호) 결과.건너뜀.push(`${소스}: 이 정책의 번호가 매핑돼 있지 않다`);
  }

  let youth = null;
  if (YOUTH_KEY && policy.youthPolicyNo) {
    try {
      const r = await callYouth({ plcyNo: policy.youthPolicyNo, pageNum: 1, pageSize: 5 });
      const hit = (r.youthPolicyList ?? []).find((p) => p.plcyNo === policy.youthPolicyNo);
      if (hit) youth = fromYouth(hit);
      else 결과.조회실패.push(`온통청년: plcyNo ${policy.youthPolicyNo} 응답에 없음`);
    } catch (err) {
      결과.조회실패.push(`온통청년: ${err.message}`);
    }
  }

  let gov24 = null;
  if (GOV24_KEY && policy.gov24ServiceId) {
    try {
      const b = await callGov24({ page: 1, perPage: 5, "cond[서비스ID::EQ]": policy.gov24ServiceId });
      const hit = (b.data ?? []).find((r) => r["서비스ID"] === policy.gov24ServiceId);
      if (hit) gov24 = fromGov24(hit);
      else 결과.조회실패.push(`보조금24: 서비스ID ${policy.gov24ServiceId} 응답에 없음`);
    } catch (err) {
      결과.조회실패.push(`보조금24: ${err.message}`);
    }
  }

  const app = {
    name: policy.name,
    applicationStart: policy.applicationStart,
    applicationEnd: policy.applicationEnd,
    ageMin: policy.discovery?.ageMin ?? null,
    ageMax: policy.discovery?.ageMax ?? null,
  };

  // 어느 등록이 언제 손봐졌는지. 앱 검수일보다 오래된 등록이 낸 이견은
  // "앱을 의심하라"가 아니라 "바깥이 낡았다"로 읽어야 한다.
  const updatedAt = { 온통청년: youth?.updatedAt ?? null, 보조금24: gov24?.updatedAt ?? null };
  결과.갱신일 = updatedAt;

  for (const f of FIELDS) {
    결과.필드.push(
      compareField({
        field: f.field,
        app: f.pick(app),
        youth: youth ? f.pick(youth) : null,
        gov24: gov24 ? f.pick(gov24) : null,
        normalize: f.normalize,
        appVerifiedAt: policy.verifiedAt,
        updatedAt,
      })
    );
  }
  return 결과;
}

// ── 2) 익산 주거 목록 감시 ──────────────────────────────────────────────

/** 지문에 넣을 필드. 바뀌면 사람이 봐야 하는 서술들이다. */
const 지문필드 = ["서비스명", "지원대상", "선정기준", "지원내용", "신청기한", "신청방법", "지원유형"];

async function 익산감시() {
  const b = await callGov24({ page: 1, perPage: 100, ...IKSAN_QUERY });
  const next = {};
  for (const r of b.data ?? []) {
    next[r["서비스ID"]] = {
      name: r["서비스명"],
      fingerprint: fingerprintRecord(Object.fromEntries(지문필드.map((k) => [k, r[k]]))),
    };
  }

  let prev = null;
  try {
    prev = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    // 첫 실행이면 기준선이 없다. 비교 없이 기록만 남긴다.
  }

  const diff = prev ? diffSnapshots(prev.services, next) : null;
  writeFileSync(
    SNAPSHOT_PATH,
    JSON.stringify({ 조회일: todayISO(), 조회조건: IKSAN_QUERY, services: next }, null, 2) + "\n",
    "utf8"
  );
  return { diff, 건수: Object.keys(next).length, 첫실행: !prev };
}

// ── 실행 ────────────────────────────────────────────────────────────────

const today = todayISO();
const policies = JSON.parse(readFileSync(join(WEB_ROOT, "data", "policies.json"), "utf8"));

const md = [];
const w = (s = "") => md.push(s);

w(`# 정책 데이터 신선도 보고 — ${today}`);
w();
w("> 자동 생성. **이 스크립트는 `policies.json` 을 고치지 않는다.**");
w("> 아래 항목은 팀이 공고 원문을 열어 확인한 뒤 손으로 반영한다.");
w();

// 어느 소스를 못 봤는지부터 밝힌다. 조용히 건너뛰면 "확인했는데 문제 없음"으로 읽힌다.
const 빠진소스 = [];
if (!YOUTH_KEY) 빠진소스.push("온통청년(`YOUTH_API_KEY`)");
if (!GOV24_KEY) 빠진소스.push("보조금24(`BOJOGEUM_KEY`)");
if (빠진소스.length > 0) {
  w(`> [!WARNING]`);
  w(`> 인증키가 없어 **${빠진소스.join(", ")}** 는 조회하지 못했다.`);
  w(`> 이 보고는 나머지 소스만 본 결과다.`);
  w();
}

let 검토필요 = false;

// 1) 3자 대조
w("## 1. 3자 대조 (앱 · 온통청년 · 보조금24)");
w();
if (!YOUTH_KEY && !GOV24_KEY) {
  w("두 소스 다 조회하지 못해 대조를 건너뛰었다.");
  w();
} else {
  for (const policy of policies) {
    const r = await 대조(policy);
    const 어긋남 = r.필드.filter((f) => f.needsReview);
    const 대조가능 = r.필드.filter((f) => f.verdict !== "대조불가");

    // 대조한 게 하나도 없으면 "어긋남 없음"이라고 쓰면 안 된다. 아무도 확인하지
    // 않은 값이 확인된 값처럼 읽힌다 — 팀이 온통청년 배지를 걷어낸 이유와 같다.
    if (대조가능.length === 0) {
      w(`- **${r.name}** — ⚠️ 대조 못 함: ${[...r.조회실패, ...r.건너뜀].join(" / ")}`);
      continue;
    }

    if (어긋남.length === 0 && r.조회실패.length === 0) {
      const 이름 = 대조가능.map((f) => f.field).join("·");
      w(`- **${r.name}** — 어긋남 없음 (대조한 필드 ${대조가능.length}/${r.필드.length}: ${이름})`);
      continue;
    }

    검토필요 = 검토필요 || 어긋남.length > 0;
    w(`- **${r.name}**`);
    for (const f of 어긋남) {
      w(`  - \`${f.field}\` · 우선순위 **${f.priority}** — ${f.detail}`);
      w(`    - 앱: \`${f.app ?? "—"}\` / 온통청년: \`${f.youth ?? "말하지 않음"}\` / 보조금24: \`${f.gov24 ?? "말하지 않음"}\``);
    }
    for (const 실패 of r.조회실패) w(`  - 조회 실패 — ${실패}`);
  }
  w();
}

// 2) 익산 주거 목록
w("## 2. 익산 주거 사업 목록 (보조금24)");
w();
if (!GOV24_KEY) {
  w("`BOJOGEUM_KEY` 가 없어 건너뛰었다.");
  w();
} else {
  try {
    const { diff, 건수, 첫실행 } = await 익산감시();
    if (첫실행) {
      w(`기준선을 처음 기록했다 — 현재 ${건수}건. 다음 실행부터 변화를 비교한다.`);
    } else if (diff.신규.length + diff.변경.length + diff.사라짐.length === 0) {
      w(`변화 없음 (${건수}건).`);
    } else {
      검토필요 = true;
      for (const [제목, 목록] of [["신규 등록", diff.신규], ["내용 변경", diff.변경], ["목록에서 사라짐", diff.사라짐]]) {
        if (목록.length === 0) continue;
        w(`### ${제목} ${목록.length}건`);
        for (const x of 목록) {
          w(`- ${x.name} — https://www.gov.kr/portal/rcvfvrSvc/dtlEx/${x.id}`);
        }
        w();
      }
    }
  } catch (err) {
    w(`조회 실패 — ${err.message}`);
    검토필요 = true;
  }
  w();
}

// 3) verifiedAt 낡음
w(`## 3. 대조한 지 ${STALE_DAYS}일 넘은 정책`);
w();
const 낡음 = policies
  .map((p) => ({ p, 경과: p.verifiedAt ? daysBetween(p.verifiedAt, today) : null }))
  .filter(({ p, 경과 }) => p.verifiedAt === null || 경과 > STALE_DAYS);

if (낡음.length === 0) {
  w(`전부 ${STALE_DAYS}일 이내에 대조됐다.`);
} else {
  검토필요 = true;
  for (const { p, 경과 } of 낡음) {
    w(p.verifiedAt === null
      ? `- **${p.name}** — 아직 팀 교차검수 전 (\`verifiedAt: null\`) · ${p.sourceUrl}`
      : `- **${p.name}** — ${p.verifiedAt} 확인, ${경과}일 경과 · ${p.sourceUrl}`);
  }
}
w();

const report = md.join("\n");
writeFileSync(REPORT_PATH, report, "utf8");
console.log(report);
console.error(`\n보고서: ${REPORT_PATH}`);
process.exit(검토필요 ? 10 : 0);
