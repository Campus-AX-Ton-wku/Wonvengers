#!/usr/bin/env node
/**
 * 온통청년 청년정책 API — 팀이 쓰는 내부 발굴 도구.
 *
 * 앱은 정책 출처를 **지역 공고 하나**로 간다 (policies.json 의 sourceUrl).
 * 여기서 받은 값은 화면에 나가지 않는다. 하는 일은 두 가지다.
 *
 *   1) docs/기획/온통청년-주거후보.md — 1층 정책을 8~12개로 늘릴 때 볼 후보 목록
 *   2) 콘솔 보고 — 이미 매핑한 정책의 등록 정보가 앱 데이터와 어긋나는 지점
 *
 * ── 왜 화면에서 뺐는가 ───────────────────────────────────────────────
 *
 * 한때 이 값을 "정부 DB 와 대조했다"고 카드에 표시했다. 커버리지가 그걸
 * 뒷받침하지 못해서 뺐다.
 *
 *  - 지역 필터(zipCd)가 안 걸린다. 익산으로 조회했는데 경상북도 의성군
 *    사업이 섞여 들어오고, 정작 익산 이사비·중개보수는 결과에 없다.
 *  - 대분류 하나(`주거`)로만 조회하므로, 다른 분류에 등록된 정책은
 *    "없다"고 말할 근거가 되지 않는다.
 *  - 등록 정보 자체가 낡는다. 이미 끝난 신청기간이 그대로 남아 있다.
 *
 * 즉 "미등록"이라고 말할 수 있는 근거가 없다. 확인한 사실만 말해야 하므로
 * 사용자 화면에는 팀이 직접 대조한 지역 공고만 남겼다.
 *
 * ── 왜 런타임이 아니라 스크립트인가 ──────────────────────────────────
 *
 *  - 앱은 `output: "export"` 정적 배포다. 런타임에 호출을 대신해 줄 서버가 없다.
 *  - 이 API 는 브라우저 직접 호출을 허용하지 않는다 (프리플라이트 403).
 *  - 인증키를 클라이언트 번들에 넣으면 누구나 볼 수 있다.
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
import { classifyAgency } from "./discovery-region.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

const API = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

/**
 * 1층 발견 목록을 늘릴 때 훑을 범위.
 *
 * 예전에는 `zipCd: "52140"` 을 쿼리로 넘겼는데 필터가 걸리지 않았다 — 익산으로
 * 조회했는데 경상북도 의성군 사업이 섞여 들어오고 정작 익산 이사비는 빠졌다.
 *
 * 응답의 `zipCd` 는 그 정책이 적용되는 시군구 코드를 전부 나열한 목록이다
 * (전국 사업이면 229개가 다 들어 있다). 그래서 대분류만 걸어 전부 받은 뒤
 * 여기서 직접 거른다. 전국 사업도 이 방식이라야 잡힌다 — 예전 쿼리로는
 * 전세보증금반환보증 보증료 지원 같은 국토부 사업이 아예 안 나왔다.
 */
const DISCOVERY_QUERY = { lclsfNm: "주거" };

/**
 * 전국화 Phase 1 파일럿 대상 — 전북특별자치도 익산시 + 인접 5개 시.
 *
 * 예전엔 이 시들을 zipCd 로 가려냈는데, "강원형 공공주택 공급"(강원 전용)이
 * zipCd 251개(전국급)로 등록돼 있는 걸 발견하면서 zipCd 자체를 신뢰할 수
 * 없다는 게 드러났다. 지금은 등록기관명으로 가른다 — discovery-region.mjs
 * 의 classifyAgency 참고. 이 배열은 이제 "어느 시 이름을 파일럿으로 볼지"만
 * 정하는 순수 이름 목록이다.
 */
const PILOT_CITIES = ["익산시", "전주시", "군산시", "정읍시", "남원시", "김제시"];
const PILOT_PROVINCE = "전북특별자치도";

/** 한 번에 받을 수 있는 최대 건수와, 그 페이지를 몇 장까지 넘길지. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

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
    // 아래 넷은 후보를 추릴 때 사람이 읽는 값이다. 여기서 파싱하지 않는다 —
    // 자유 서술이라 금액·소득 기준을 코드로 뽑으면 조용히 틀린 값이 들어간다.
    // policies.json 의 monthlyCap·incomeBracketMax 는 공고 원문을 보고 손으로 넣는다.
    supportContent: emptyToNull(p.plcySprtCn),
    incomeNote: emptyToNull(p.earnEtcCn),
    documents: emptyToNull(p.sbmsnDcmntCn),
    applyMethod: emptyToNull(p.plcyAplyMthdCn),
    /** 전국·광역·시군구 분류의 근거. classifyAgency 참고 — zipCd 는 안 쓴다. */
    agencyScope: classifyAgency(p.rgtrInstCdNm),
  };
}

/** 대분류 하나를 끝까지 넘겨 받는다. 주거 대분류는 지금 282건이라 3페이지다. */
async function fetchAllPages(key, params) {
  const out = [];
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const result = await callApi(key, { ...params, pageNum, pageSize: PAGE_SIZE });
    const list = result.youthPolicyList ?? [];
    out.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return out;
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
 * 콘솔 보고에만 쓴다 — 팀이 "공고를 다시 볼까"를 판단하는 힌트다.
 * 어느 쪽이 맞는지는 이 스크립트가 알 수 없다. 온통청년 등록이 낡은 경우가 있다.
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
    report.push({ id: policy.id, state: "번호 미매핑", detail: "youthPolicyNo 가 null — 아직 온통청년 정책번호를 찾아 넣지 않았다" });
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

// 2) 1층 확장용 후보 목록 — 전국화 Phase 1 파일럿(전북 6개 시 + 도 단위)
let candidateMd = "";
try {
  const rows = (await fetchAllPages(key, DISCOVERY_QUERY)).map(pickRecord);
  const mapped = new Set(policies.map((p) => p.youthPolicyNo).filter(Boolean));

  const line = (r) =>
    `| ${r.name ?? "-"} | ${r.agency ?? "-"} | ${r.mediumCategory ?? "-"} | ${r.applyPeriod ?? "미기재"} | ` +
    `${r.ageUnlimited ? "제한없음" : `${r.ageMin}~${r.ageMax}`} | ${r.supportScale || "-"}${r.firstComeFirstServed ? " (선착순)" : ""} | ` +
    `${r.applyUrl ? `[링크](${r.applyUrl})` : "없음"} | ${r.lastModifiedAt?.slice(0, 10) ?? "-"} | \`${r.plcyNo}\` |`;

  const header =
    "| 정책명 | 주관기관 | 중분류 | 신청기간 | 나이 | 규모 | 신청URL | 최종수정 | plcyNo |\n" +
    "|---|---|---|---|---|---|---|---|---|";

  /** 자유 서술은 표에 넣으면 읽을 수 없다. 후보를 고를 만큼만 잘라 목록으로 낸다. */
  const 줄여서 = (text, limit) => {
    if (!text) return null;
    const 한줄 = text.replace(/\s+/g, " ").trim();
    return 한줄.length > limit ? `${한줄.slice(0, limit)}…` : 한줄;
  };

  const 상세 = (r) =>
    [
      `### ${r.name}`,
      ``,
      `- 주관: ${r.agency ?? "-"} · 신청기간: ${r.applyPeriod ?? "미기재"} · 나이: ${
        r.ageUnlimited ? "제한없음" : `${r.ageMin}~${r.ageMax}`
      }`,
      `- plcyNo: \`${r.plcyNo}\`${r.applyUrl ? ` · [신청](${r.applyUrl})` : ""}${
        r.referenceUrl ? ` · [참고](${r.referenceUrl})` : ""
      }`,
      r.supportContent ? `- 지원내용: ${줄여서(r.supportContent, 400)}` : null,
      r.incomeNote ? `- 소득조건: ${줄여서(r.incomeNote, 200)}` : null,
      r.documents ? `- 제출서류: ${줄여서(r.documents, 200)}` : null,
      r.applyMethod ? `- 신청방법: ${줄여서(r.applyMethod, 200)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  /** 신청기간이 지난 지 오래됐거나(2년+) 아예 없는 후보는 검토 우선순위가 낮다는 표시만 붙인다 — 걸러내지는 않는다. */
  const 오래된힌트 = (r) => {
    const period = parseApplyPeriod(r.applyPeriod);
    if (!period?.end) return "";
    const 종료 = new Date(period.end);
    const 개월차 = (Date.now() - 종료.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Number.isFinite(개월차) && 개월차 > 24 ? " ⚠️낡음" : "";
  };

  // classifyAgency 는 한 정책을 전국·광역·시군구 중 정확히 하나로만 분류하므로
  // (등록기관명 하나에 시도명이 여러 번 걸릴 수 없다), 예전처럼 "이미 잡힌 정책은
  // 빼고 세기" 위한 별도 집합이 필요 없다 — 겹칠 수 없는 구조라서다.
  const national = rows.filter((r) => r.agencyScope.scope === "national");
  const provinceWide = rows.filter(
    (r) => r.agencyScope.scope === "province" && r.agencyScope.province === PILOT_PROVINCE
  );
  const byCity = new Map(
    PILOT_CITIES.map((city) => [
      city,
      rows.filter(
        (r) =>
          r.agencyScope.scope === "city" &&
          r.agencyScope.province === PILOT_PROVINCE &&
          r.agencyScope.city === city
      ),
    ])
  );

  const section = (title, note, list, { detailed = false } = {}) => {
    const fresh = list.filter((r) => !mapped.has(r.plcyNo));
    const already = list.filter((r) => mapped.has(r.plcyNo));
    const body = detailed
      ? fresh.map((r) => 상세(r) + 오래된힌트(r)).join("\n\n") || "_해당 없음_"
      : `${header}\n${fresh.map((r) => line(r) + 오래된힌트(r)).join("\n") || "_해당 없음_"}`;
    return {
      fresh,
      already,
      md: `## ${title} — 신규 후보 ${fresh.length}건 (매핑됨 ${already.length}건 제외)\n\n` + (note ? `${note}\n\n` : "") + `${body}\n`,
    };
  };

  const nationalSection = section(
    "전국 (등록기관이 중앙부처·산하기관)",
    "> 참고용 — 이번 파일럿(전북 6개 시) 범위 밖이다. 검증하면 6개 시뿐 아니라 전국 모든 사용자에게 적용된다.",
    national
  );
  // 도 단위는 건수가 적고(대개 한 자릿수) 검증 우선순위가 가장 높으므로 상세 카드로,
  // 시별은 건수가 많아 표로 훑을 수 있게 한다.
  const provinceSection = section(
    `${PILOT_PROVINCE} 도 단위 (등록기관이 ${PILOT_PROVINCE} 자체)`,
    "> 여기 있는 정책 1건을 검증하면 파일럿 6개 시(익산 포함) 전부를 한 번에 커버한다.",
    provinceWide,
    { detailed: true }
  );
  const citySections = PILOT_CITIES.map((city) => section(city, null, byCity.get(city)));

  // 파일럿 범위(도 단위 + 시별)만 센다 — 전국 후보는 이번 파일럿의 검증 대상이 아니라 참고용이다.
  const 파일럿신규 = [...provinceSection.fresh, ...citySections.flatMap((s) => s.fresh)];
  // classifyAgency 는 한 정책을 정확히 한 버킷에만 넣으므로(전국·광역·시군구가
  // 겹치지 않는다) 이제 이 중복 제거는 사실 필요 없지만, 시 목록이 plcyNo 를
  // 기준으로 세어야 한다는 것 자체는 여전히 맞는 표현이라 그대로 둔다.
  const 중복제거총건수 = new Set(파일럿신규.map((r) => r.plcyNo)).size;

  candidateMd =
    `# 온통청년 주거 정책 후보 — 전국화 Phase 1 파일럿 (전북 6개 시)\n\n` +
    `> 자동 생성 — \`npm run fetch:youth\` 로 갱신한다. 조회일 **${today}**\n` +
    `> 조회 조건: 대분류 \`주거\` 전건(${rows.length}건)을 받아, 응답의 등록기관명\n` +
    `> (\`rgtrInstCdNm\`)으로 전국 · 전북 도 단위 · 시별 셋으로 가른다(zipCd 는 안 쓴다\n` +
    `> — scripts/discovery-region.mjs 머리말 참고). 파일럿 대상: 익산시(기존) ·\n` +
    `> 전주시 · 군산시 · 정읍시 · 남원시 · 김제시.\n\n` +
    `**파일럿 범위(도 단위 + 시별) 신규 후보 총 ${중복제거총건수}건** ` +
    `(도 단위 ${provinceSection.fresh.length}건 + 시별 ${citySections.reduce((n, s) => n + s.fresh.length, 0)}건, plcyNo 중복 제거 기준). ` +
    `전국 후보는 참고용 ${nationalSection.fresh.length}건 별도.\n\n` +
    `> [!WARNING]\n` +
    `> 이 목록은 후보일 뿐이다. 사업 계획처럼 개인이 신청할 수 없는 항목, 이미 끝난\n` +
    `> 신청기간이 낡은 채로 남은 항목(⚠️낡음 표시, 종료일 2년+ 경과)도 지역 조건만\n` +
    `> 맞으면 여기 들어온다. '지원내용'은 온통청년 **등록 정보**를 그대로 옮긴 것이니\n` +
    `> 반드시 공고 원문을 열어 확인하고 \`verifiedAt\`을 채운 뒤 \`policies.json\`에 넣는다.\n\n` +
    `${provinceSection.md}\n` +
    `${citySections.map((s) => s.md).join("\n")}\n` +
    `${nationalSection.md}`;

  const outDir = join(REPO_ROOT, "docs", "기획");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "온통청년-주거후보.md"), candidateMd, "utf8");

  // Phase 2 작업량 산정용 — 전북 파일럿과 무관하게, 대분류 `주거` 전체(rows)를
  // 등록기관 스코프로 다시 센 값이다. 새 API 조회 없이 이미 받은 데이터를
  // 재분류만 한 것 — scripts/discovery-region.mjs 의 classifyAgency 가 기준이다.
  const 전국건수 = national.length;
  const 광역별건수 = new Map();
  const 시군구건수 = { total: 0, uniqueCities: new Set() };
  for (const r of rows) {
    const { scope, province, city } = r.agencyScope;
    if (scope === "province") 광역별건수.set(province, (광역별건수.get(province) ?? 0) + 1);
    if (scope === "city") {
      시군구건수.total++;
      시군구건수.uniqueCities.add(`${province} ${city}`);
    }
  }
  // "전국" 은 광역명 어디에도 안 걸린 것 전부다 — 진짜 중앙부처(국토교통부 등)와
  // 등록기관명이 "청년정책관"처럼 소속 없이 텅 빈 경우가 섞여 있다. 후자는
  // 전국이 확인된 게 아니라 그냥 어디 소속인지 모르는 것이다. 이 둘을 자동으로
  // 가르는 신뢰할 만한 규칙이 없어(부서명 자체는 어느 지자체에나 있을 수 있다),
  // "전국" 건수를 볼 때는 그 안에 미상 건이 섞여 있을 수 있음을 감안해야 한다.
  console.log("\n전국화 Phase 2 범위 산정 (등록기관명 기준 재분류, 신규 API 조회 없음)\n");
  console.log(`  전국(중앙부처·산하기관, 소속 불명 포함) ${전국건수}건`);
  console.log(`  광역(시도 자체)          ${[...광역별건수.values()].reduce((a, b) => a + b, 0)}건 · ${광역별건수.size}개 시도`);
  for (const [province, count] of [...광역별건수.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    - ${province.padEnd(12, "　")} ${count}건`);
  }
  console.log(`  시군구(시도 소속 시·군·구) ${시군구건수.total}건 · ${시군구건수.uniqueCities.size}개 시군구`);
} catch (err) {
  console.error(`후보 목록 조회 실패 (대조 보고는 정상): ${err.message}`);
}

// ── 사람이 읽는 보고 ────────────────────────────────────────────────────

console.log(`\n온통청년 대조 결과 (조회일 ${today})\n`);
for (const r of report) {
  console.log(`  ${r.state.padEnd(10)} ${r.id}`);
  if (r.detail) console.log(`             ${r.detail}`);
}
console.log(`\n  매핑된 정책 ${Object.keys(records).length}건 조회 · 번호 미매핑 ${unregistered}건`);
console.log("  (이 값은 화면에 나가지 않는다. 앱이 보여주는 출처는 policies.json 의 sourceUrl 이다.)");
if (candidateMd) console.log(`  docs/기획/온통청년-주거후보.md — 후보 목록 갱신됨`);
console.log("");
