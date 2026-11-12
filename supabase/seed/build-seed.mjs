// supabase/seed.sql 을 만든다 — 손으로 고치지 말고 이 스크립트를 다시 돌린다.
//
//   node supabase/seed/build-seed.mjs          # seed.sql 다시 쓰기
//   node supabase/seed/build-seed.mjs --check  # seed.sql 이 지금 JSON 과 같은지만 확인
//
// 넣는 것 (2026-11-11 확정 방식, docs/기획/2026-11-11-DB-익산-원문검수-계획.md)
//   - 정책 16건 = 익산 사용자에게 보이는 14건(apps/web/data) + 새 후보 2건(보조금24 원문, 상태 '보류')
//   - 시행처·문의 창구 + 지역 상담 창구 4곳(consult-centers.json)
//   - 새 후보 2건의 보조금24 API 응답 원문 (seed/raw/)
// 넣지 않는 것
//   - 확인 기록(policy_checks). ggue 의 11/3 재대조는 그때 ggue 가 값을 직접 고친 것이라
//     검수 기록이 아니라 edit_note 에 남긴다 (계획서 "절대 하지 말 것" 8번: 자기가 고친 값을 자기가 검수하지 않는다).
//   - 14건의 API 원문 — 계획서 7번(박민준, API 원문 수집)에서 따로 넣는다.
//
// 규칙
//   - 14건은 JSON 값을 그대로 옮긴다. 이 스크립트가 값을 새로 정하지 않는다 (F0-5 추정 금지).
//   - 사람이 정한 분류(지원 목적 PURPOSE, 기관 단계 AGENCY)는 아래 표에 적어 두고, 표에 없는 값이 나오면 멈춘다.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const dataDir = join(repo, "apps", "web", "data");
const json = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));
const OUT = join(repo, "supabase", "seed.sql");

// ── 사람이 정한 표 ──────────────────────────────────────────────────────
const REGION = { "전국": "00", "전북특별자치도": "52", "전북특별자치도 익산시": "52140" };

// 지원 목적. 11/9 설계 검사(redesign.test.mjs)의 표 + 이번에 새로 정한 5개(★)
const PURPOSE = {
  "moland-youth-rent-support": "주거비 경감",
  "iksan-youth-rent-support": "주거비 경감",
  "jeonbuk-youth-settlement-support": "이주·정착",
  "iksan-newcomer-moving-cost-support": "이주·정착",
  "youth-housing-benefit-split-payment": "주거비 경감",
  "jeonse-return-guarantee-fee-subsidy": "보증금 안전",
  "youth-btm-jeonse-loan": "주거비 경감",
  "iksan-youth-home-purchase-loan-interest": "자산 형성",
  "youth-dream-didimdol-loan": "자산 형성",
  "youth-dream-savings-account": "자산 형성",
  "kosaf-goyang-dormitory": "주택 공급",
  "youth-btm-monthly-rent-loan": "주거비 경감",              // ★ 버팀목 전세와 같은 기준
  "iksan-youth-jeonse-loan-interest": "주거비 경감",         // ★ 버팀목 전세와 같은 기준
  "iksan-public-rental-deposit-support": "주거비 경감",      // ★ 임대보증금 대출이자 지원
  "iksan-move-in-household-incentive": "이주·정착",          // ★ 새 후보 — 전입장려금
  "iksan-move-in-student-support": "이주·정착",              // ★ 새 후보 — 주소전입 학생
};

// 지원 형태. policies.json 은 현금, 단 계획서 표에서 '보증료'로 정한 1건은 예외
const KIND_OVERRIDE = { "jeonse-return-guarantee-fee-subsidy": "보증료" };
const LOAN_KIND = { loan_interest_subsidy: "대출", guarantee_fee_subsidy: "보증료", savings_account: "저축" };

// 기관 단계·지역. 이름 여러 개가 · 로 묶이면 맨 앞 기관 기준
const AGENCY = {
  "국토교통부": ["중앙부처", "00"],
  "국토교통부·보건복지부": ["중앙부처", "00"],
  "국토교통부·주택도시보증공사(HUG)": ["중앙부처", "00"],
  "국토교통부·주택도시기금": ["중앙부처", "00"],
  "교육부·한국장학재단 청년주거지원부": ["중앙부처", "00"],
  "전북특별자치도": ["시도", "52"],
  "전북특별자치도·익산시": ["시도", "52"],
  "익산시": ["시군구", "52140"],
  "LH": ["공공기관", "00"],
  "주택도시보증공사(HUG)": ["공공기관", "00"],
  "한국장학재단": ["공공기관", "00"],
  "익산청년시청": ["시군구", "52140"],
  "전북청년허브센터": ["공공기관", "52"],
  "마이홈 콜센터": ["공공기관", "00"],
};
const CENTER_KIND = { "익산청년시청": "청년센터", "전북청년허브센터": "청년센터", "마이홈 콜센터": "콜센터" };

const JSON_EDITOR = "seed 이관(JSON 원본)";
const DRAFT_EDITOR = "seed 초안(보조금24 원문)";

// ── SQL 글자 ────────────────────────────────────────────────────────────
const lit = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "'" + String(v).replaceAll("'", "''") + "'";
};
const arr = (a, type) => (a == null ? "null" : `array[${a.map(lit).join(", ")}]::${type}[]`);
const need = (map, key, what) => {
  if (!(key in map)) throw new Error(`${what} 표에 없음: ${key} — 사람이 정해서 build-seed.mjs 에 적어야 한다`);
  return map[key];
};

// ── 기관·창구 ───────────────────────────────────────────────────────────
const agencies = new Map(); // "이름|부서" → 행
function addAgency({ name, department = "", contact_kind = "담당부서", phone = null, hours = null,
  offers_consult = null, homepage = null, verified_at = null, raw = null }) {
  const [level, region] = need(AGENCY, name, "기관");
  const key = `${name}|${department}`;
  const prev = agencies.get(key);
  if (prev) {
    if (phone && prev.phone && prev.phone !== phone) return null; // 같은 부서·다른 번호 → 부르는 쪽이 이름을 나눈다
    prev.phone ??= phone; prev.hours ??= hours; prev.homepage ??= homepage;
    prev.offers_consult ??= offers_consult; prev.verified_at ??= verified_at;
    return prev;
  }
  const row = { name, department, level, region, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw };
  agencies.set(key, row);
  return row;
}
// JSON 의 contact.department("익산시 주택과 주거정책계")를 기관 + 부서로 나눈다
function addContact(dept, phone, homepage, verifiedAt, label, raw = null) {
  const clean = dept.split(" — ")[0].trim();
  const sp = clean.indexOf(" ");
  const name = sp < 0 ? clean : clean.slice(0, sp);
  const department = sp < 0 ? "" : clean.slice(sp + 1);
  const contact_kind = /콜센터/.test(department) ? "콜센터" : "담당부서";
  const base = { name, contact_kind, phone, homepage, verified_at: verifiedAt, raw };
  return addAgency({ ...base, department })
    ?? addAgency({ ...base, department: `${department} (${label})` });   // 같은 부서인데 번호가 다르면 정책 이름을 붙인다
}
const ref = (a) => `(select id from public.agencies where name = ${lit(a.name)} and department = ${lit(a.department)})`;

// ── 정책 14건 (JSON) ────────────────────────────────────────────────────
const inScope = (x) => x.regionScope in REGION;
const sources = [
  ["policies.json", (x) => KIND_OVERRIDE[x.id] ?? "현금"],
  ["loan-products.json", (x) => need(LOAN_KIND, x.productType, "대출 종류")],
  ["housing-supply.json", () => "임대"],
];
const dataCommit = (() => {
  try { return execSync("git log -1 --format=%h -- apps/web/data", { cwd: repo }).toString().trim(); }
  catch { return "?"; }
})();

const policies = [];
for (const [file, kindOf] of sources) {
  for (const x of json(file).filter(inScope)) {
    const kind = kindOf(x);
    const d = x.discovery ?? null;
    const c = x.contact;
    if (!c?.phone) throw new Error(`${x.id}: JSON 에 문의처가 없다`);
    const notes = [];
    if (!d) notes.push("[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. " +
      "나이 칸이 둘 다 비면 DB 는 '나이 제한 없음'으로, 주거 칸이 비면 '계약 형태 무관'으로 읽는다. 원문 대조 때 채울 것.");
    if (kind !== "현금" && x.benefitType) notes.push(`[seed] JSON benefitType=${x.benefitType}, lumpSumBasis=${x.lumpSumBasis ?? "없음"} — 지원 형태가 '${kind}'라 DB 규칙상 benefit_type 은 비웠다.`);
    const extra = Object.fromEntries(Object.entries({
      youthPolicyNo: x.youthPolicyNo, gov24ServiceId: x.gov24ServiceId, location: x.location, deposit: x.deposit,
      monthlyRentMin: x.monthlyRentMin, monthlyRentMax: x.monthlyRentMax, capacityLabel: x.capacityLabel,
      applicationPeriodNote: x.applicationPeriodNote,
    }).filter(([, v]) => v != null));
    if (Object.keys(extra).length) notes.push("[JSON 기타 칸] " + JSON.stringify(extra));
    if (x.notes) notes.push(x.notes);
    policies.push({
      policy_no: x.id, year: x.effectiveYear, file, kind,
      agency: addAgency({ name: x.agency }),
      contact: addContact(c.department, c.phone, c.url, c.phoneCheckedAt ?? null, x.name),
      source_url: x.sourceUrl, apply_url: x.applyUrl ?? null, name: x.name,
      purpose: need(PURPOSE, x.id, "지원 목적"), status: "운영",
      summary: x.benefitSummary ?? x.summary,
      apply_start: x.applicationStart ?? null, apply_end: x.applicationEnd ?? null,
      age_min: d?.ageMin ?? null, age_max: d?.ageMax ?? null,
      region_codes: [REGION[x.regionScope]], region_label: x.regionScope,
      statuses: d?.statuses ?? null,
      income_bracket_min: d?.incomeBracketMin ?? null, income_bracket_max: d?.incomeBracketMax ?? null,
      housing_types: d?.housingTypes ?? null,
      benefit_type: kind === "현금" ? x.benefitType : null,
      monthly_cap: x.monthlyCap ?? null, max_months: x.maxMonths ?? null,
      lump_sum_cap: x.lumpSumCap ?? null, lump_sum_basis: kind === "현금" ? x.lumpSumBasis ?? null : null,
      exclusive_groups: x.exclusiveGroup ?? null, required_inputs: x.requiredInputs ?? null,
      notes: notes.join("\n\n"),
      edited_by: JSON_EDITOR,
      edit_note: `apps/web/data/${file} 이관 (데이터 커밋 ${dataCommit}). 값은 ggue 가 2026-11-03 원문 재대조 때 ` +
        `고친 것(verifiedAt ${x.verifiedAt}) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.`,
    });
  }
}
if (policies.length !== 14) throw new Error(`익산 사용자에게 보이는 정책이 14건이 아니다: ${policies.length}건`);

// ── 지역 상담 창구 4곳 ──────────────────────────────────────────────────
const centers = json("consult-centers.json");
if (centers.length !== 4) throw new Error(`상담 창구가 4곳이 아니다: ${centers.length}`);
for (const c of centers) {
  const common = { phone: c.phone, hours: c.hours, homepage: c.url, offers_consult: true, verified_at: c.verifiedAt };
  if (c.name in AGENCY) addAgency({ name: c.name, contact_kind: need(CENTER_KIND, c.name, "상담 창구 종류"), ...common });
  else {
    const a = addContact(c.name, c.phone, c.url, c.verifiedAt, c.name);
    Object.assign(a, { hours: a.hours ?? c.hours, offers_consult: true, verified_at: a.verified_at ?? c.verifiedAt });
  }
}

// ── 새 후보 2건 (보조금24 원문 → 상태 '보류') ───────────────────────────
const raws = [];
const CANDIDATES = [
  { id: "468100000001", policy_no: "iksan-move-in-household-incentive" },
  { id: "468100000005", policy_no: "iksan-move-in-student-support" },
];
for (const cand of CANDIDATES) {
  const raw = JSON.parse(readFileSync(join(here, "raw", `gov24-${cand.id}.json`), "utf8"));
  const det = raw.serviceDetail.data[0];
  const lst = raw.serviceList.data[0];
  if (det["서비스ID"] !== cand.id || lst["서비스ID"] !== cand.id) throw new Error(`${cand.id}: 원문 번호가 다르다`);
  if (det["지원유형"] !== "현금") throw new Error(`${cand.id}: 보조금24 지원유형이 현금이 아니다(${det["지원유형"]}) — 분류를 다시 정할 것`);
  const rawRow = { kind: "보조금24API", external_id: cand.id, title: det["서비스명"], url: lst["상세조회URL"],
    payload: raw, retrieved_at: raw.fetchedAt, retrieved_by: "노찬영 PC Claude (보조금24 API, seed/raw/)" };
  raws.push(rawRow);
  const [dept, phone] = det["문의처"].split("/").map((s) => s.trim());       // "익산시청 기획예산과/063-859-5043"
  if (!/^익산시청 /.test(dept)) throw new Error(`${cand.id}: 문의처 형식이 예상과 다르다: ${det["문의처"]}`);
  const supportLine = det["지원내용"].split(/\r?\n/).find((l) => l.includes("지원내용 :"))?.replace(/^.*지원내용 :\s*/, "").trim();
  if (!supportLine) throw new Error(`${cand.id}: 지원내용 줄을 못 찾았다`);
  policies.push({
    policy_no: cand.policy_no, year: 2026, file: null, kind: det["지원유형"],
    agency: addAgency({ name: "익산시" }),
    contact: addContact(`익산시 ${dept.replace(/^익산시청 /, "")}`, phone, null, null, det["서비스명"], rawRow),
    raw: rawRow,
    source_url: lst["상세조회URL"], apply_url: det["온라인신청사이트URL"], name: det["서비스명"],
    purpose: need(PURPOSE, cand.policy_no, "지원 목적"), status: "보류",
    summary: supportLine,
    apply_start: null, apply_end: null,              // 보조금24: 상시신청
    age_min: null, age_max: null, region_codes: ["52140"], region_label: "전북특별자치도 익산시",
    statuses: null, income_bracket_min: null, income_bracket_max: null, housing_types: null,
    benefit_type: "lump_sum", monthly_cap: null, max_months: null,
    lump_sum_cap: null, lump_sum_basis: "notCalculable",
    exclusive_groups: null, required_inputs: null,
    notes: [
      "[seed 초안] 보조금24 API 응답(policy_raw, seed/raw/gov24-" + cand.id + ".json)에서 옮겼다. 익산시 원문(조례·공고) 대조 전 — 확인 필요.",
      "지원 형태 '현금'은 보조금24 지원유형 값 그대로다. DB 규칙상 현금은 계산 방식을 골라야 해서 lump_sum + notCalculable(계산 안 함)로 두고 금액은 비웠다.",
      "조건 칸(나이·상태·소득)은 비웠다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 '나이 제한 없음'으로 읽는다.",
      `보조금24 지원대상: ${det["지원대상"].replace(/\r?\n/g, " ")}`,
      `보조금24 지원내용: ${det["지원내용"].replace(/\r?\n/g, " ")}`,
      `근거 자치법규: ${det["자치법규"] ?? "없음"} · 신청기한: ${det["신청기한"]} · 보조금24 수정일시: ${det["수정일시"]}`,
    ].join("\n"),
    edited_by: DRAFT_EDITOR,
    edit_note: `보조금24 API(서비스ID ${cand.id}, ${raw.fetchedAt.slice(0, 10)} 조회) 응답에서 옮긴 초안. 익산시 원문 확인 전이라 상태는 '보류'.`,
  });
}

// ── SQL 쓰기 ────────────────────────────────────────────────────────────
const L = [];
L.push(`-- ════════════════════════════════════════════════════════════════════════
-- Perky DB — 처음 한 번만 넣는 데이터 (seed)
--
--   ⚠️ 이 파일은 supabase/seed/build-seed.mjs 가 만든다. 손으로 고치지 말고 스크립트를 다시 돌린다.
--   ⚠️ 한 번만 실행한다. 이미 데이터가 있으면 맨 앞 검사에서 멈추고 아무것도 넣지 않는다.
--      중간에 에러가 나도 전부 취소된다(한 묶음 transaction). 고친 뒤 다시 돌리면 된다.
--
--   적용: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여 넣기 → Run
--   미리 검사: cd supabase/tests && node seed.test.mjs  (PGlite 에 SQL + seed 를 넣어 본다)
--
--   정책 ${policies.length}건 (JSON 14 + 새 후보 2 '보류') · 기관·창구 ${agencies.size}행 · 원문 ${raws.length}행 · 확인 기록 0행
--   JSON 데이터 커밋: ${dataCommit}
--
--   작성자(edited_by)는 사람 이름이 아니다 → 팀원 누구나 원문 대조 '일치'를 남길 수 있다.
--     '${JSON_EDITOR}'   — 14건, apps/web/data 값 그대로
--     '${DRAFT_EDITOR}' — 새 후보 2건, 보조금24 API 응답에서 옮긴 초안
--   ggue 의 2026-11-03 재대조는 그때 ggue 가 값을 직접 고친 것이라 검수 기록이 아니라 edit_note 에 적었다.
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if exists (select 1 from public.policies) or exists (select 1 from public.agencies)
     or exists (select 1 from public.policy_raw) or exists (select 1 from public.policy_checks) then
    raise exception '이미_적재됨' using hint = 'seed 는 한 번만 넣는다. 표가 비어 있을 때만 실행하세요.';
  end if;
end $$;
`);

L.push(`-- ── ② 원문 (새 후보 2건의 보조금24 API 응답 그대로) ──`);
for (const r of raws) {
  L.push(`insert into public.policy_raw (kind, external_id, title, url, payload, retrieved_at, retrieved_by) values (
  ${lit(r.kind)}, ${lit(r.external_id)}, ${lit(r.title)}, ${lit(r.url)},
  ${lit(JSON.stringify(r.payload))}::jsonb,
  ${lit(r.retrieved_at)}, ${lit(r.retrieved_by)});`);
}
const rawRef = (r) => r ? `(select id from public.policy_raw where kind = ${lit(r.kind)} and external_id = ${lit(r.external_id)})` : "null";

L.push(`\n-- ── ④ 시행처·문의 창구·상담 창구 ──`);
for (const a of agencies.values()) {
  L.push(`insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values (` +
    [lit(a.name), lit(a.level), lit(a.region), lit(a.department), lit(a.contact_kind), lit(a.phone), lit(a.hours),
     lit(a.offers_consult), lit(a.homepage), lit(a.verified_at), rawRef(a.raw)].join(", ") + ");");
}

L.push(`\n-- ── ③ 가공 정책 ──`);
for (const p of policies) {
  L.push(`-- ${p.name}${p.file ? ` (apps/web/data/${p.file})` : " (새 후보 · 보류)"}
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  ${lit(p.policy_no)}, ${p.year}, ${rawRef(p.raw)}, ${ref(p.agency)}, ${ref(p.contact)},
  ${lit(p.source_url)}, ${lit(p.apply_url)}, ${lit(p.name)}, ${lit(p.kind)}, ${lit(p.purpose)}, ${lit(p.status)},
  ${lit(p.summary)},
  ${lit(p.apply_start)}, ${lit(p.apply_end)}, ${lit(p.age_min)}, ${lit(p.age_max)},
  ${arr(p.region_codes, "text")}, ${lit(p.region_label)}, ${arr(p.statuses, "public.opt_status")},
  ${lit(p.income_bracket_min)}, ${lit(p.income_bracket_max)}, ${arr(p.housing_types, "public.opt_housing")},
  ${p.benefit_type ? lit(p.benefit_type) + "::public.opt_benefit_type" : "null"}, ${lit(p.monthly_cap)}, ${lit(p.max_months)},
  ${lit(p.lump_sum_cap)}, ${lit(p.lump_sum_basis)}, ${arr(p.exclusive_groups, "text")}, ${arr(p.required_inputs, "text")},
  ${lit(p.notes)},
  ${lit(p.edited_by)},
  ${lit(p.edit_note)}
);`);
}

L.push(`
-- 마지막 확인: 넣은 개수가 맞지 않으면 전부 취소
do $$
begin
  if (select count(*) from public.policies) <> ${policies.length}
     or (select count(*) from public.policies where status = '보류') <> ${CANDIDATES.length}
     or (select count(*) from public.agencies) <> ${agencies.size}
     or (select count(*) from public.policy_raw) <> ${raws.length} then
    raise exception '적재_개수_불일치';
  end if;
end $$;

commit;
`);

const sql = L.join("\n");
if (/serviceKey/i.test(sql)) throw new Error("API 키가 섞여 들어갔다 — 쓰지 않는다");
if (process.argv.includes("--check")) {
  const now = readFileSync(OUT, "utf8");
  if (now !== sql) { console.error("seed.sql 이 JSON·원문과 다르다 → node supabase/seed/build-seed.mjs 로 다시 만들 것"); process.exit(1); }
  console.log("seed.sql 최신");
} else {
  writeFileSync(OUT, sql);
  console.log(`seed.sql 작성: 정책 ${policies.length} · 기관·창구 ${agencies.size} · 원문 ${raws.length}`);
}
