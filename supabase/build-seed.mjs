// apps/web/data/*.json 을 읽어 supabase/seed.sql 을 만든다.
//
//   node supabase/build-seed.mjs
//
// DB 로 옮기는 첫 한 번에 쓰는 도구다. 손으로 SQL 을 옮겨 적으면 정책 원문을
// 옮겨 적을 때와 같은 사고(숫자 하나 틀림)가 다시 난다. 그래서 JSON 에서 기계로 만든다.
// DB 가 원본이 된 뒤에는 반대 방향(export_* 함수 → JSON 파일)만 쓴다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "apps", "web", "data");
const read = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

const policies = read("policies.json");
const loanProducts = read("loan-products.json");
const incomeBrackets = read("income-brackets.json");
const incomeThresholds = read("income-thresholds.json");

const today = new Date().toISOString().slice(0, 10);
const IMPORT_NOTE = `apps/web/data 에서 이관 (${today})`;
const LEGACY_MEMO = "JSON 의 verifiedAt 을 옮긴 기록. 원래 기록에 검수자 이름이 없다.";

function lit(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`숫자가 아님: ${v}`);
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replaceAll("'", "''")}'`;
}

// 배열은 '{"a","b"}' 글자로 적는다. 타입을 붙이지 않으면 칸의 타입(text[] 든 선택지[] 든)으로 읽힌다.
function textArray(v) {
  if (v === null || v === undefined) return "null";
  const items = v.map((s) => `"${String(s).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`);
  return lit(`{${items.join(",")}}`);
}

function insert(table, row) {
  const cols = Object.keys(row);
  return `insert into public.${table} (${cols.join(", ")})\nvalues (${cols.map((c) => row[c]).join(", ")});`;
}

// 날짜만 있는 옛 기록을 한국 시간 정오로 넣는다. 자정으로 넣으면 시간대에 따라 하루가 밀린다.
function legacyReview(column, key, verifiedAt, sourceUrl) {
  return insert("team_reviews", {
    [column]: lit(key),
    target_version: "1",
    result: lit("confirmed"),
    memo: lit(LEGACY_MEMO),
    source_url: lit(sourceUrl),
    reviewed_at: lit(`${verifiedAt} 12:00:00+09`),
    imported: "true",
  });
}

const out = [
  "-- 이 파일은 supabase/build-seed.mjs 가 만든다. 손으로 고치지 말 것.",
  `-- 원본: apps/web/data/*.json (${today})`,
  "",
  "-- 작성자를 알 수 없는 이관 데이터라 작성자 검사를 끈다. 끝에서 다시 켠다.",
  "select set_config('perky.import_mode', 'on', false);",
  "",
  "-- ── 소득 구간 ──",
];

for (const b of incomeBrackets) {
  out.push(insert("data_income_brackets", { bracket: lit(b.bracket), label: lit(b.label) }));
}

out.push("", "-- ── 기준 중위소득 ──");
const sizes = Object.keys(incomeThresholds.monthlyMedianIncomeByHouseholdSize).map(Number).sort((a, b) => a - b);
sizes.forEach((size, i) => {
  if (size !== i + 1) throw new Error(`가구원 수가 1부터 이어지지 않음: ${sizes.join(",")}`);
});
const amounts = sizes.map((s) => incomeThresholds.monthlyMedianIncomeByHouseholdSize[String(s)]);
out.push(
  insert("data_income_thresholds", {
    effective_year: lit(incomeThresholds.effectiveYear),
    is_active: "true",
    monthly_median_income: `array[${amounts.map(lit).join(", ")}]::integer[]`,
    source_label: lit(incomeThresholds.sourceLabel),
    source_url: lit(incomeThresholds.sourceUrl),
    note: lit(incomeThresholds.note),
    edit_note: lit(IMPORT_NOTE),
  })
);

out.push("", "-- ── 정책 ──");
policies.forEach((p, i) => {
  const d = p.discovery;
  out.push(
    insert("data_policies", {
      id: lit(p.id),
      status: lit("published"),
      sort_order: lit((i + 1) * 10),
      name: lit(p.name),
      agency: lit(p.agency),
      region_scope: lit(p.regionScope),
      effective_year: lit(p.effectiveYear),
      application_start: lit(p.applicationStart),
      application_end: lit(p.applicationEnd),
      benefit_type: lit(p.benefitType),
      benefit_summary: lit(p.benefitSummary),
      monthly_cap: lit(p.monthlyCap),
      max_months: lit(p.maxMonths),
      lump_sum_cap: lit(p.lumpSumCap),
      lump_sum_basis: lit(p.lumpSumBasis),
      required_inputs: textArray(p.requiredInputs),
      exclusive_group: textArray(p.exclusiveGroup),
      discovery_age_min: lit(d.ageMin),
      discovery_age_max: lit(d.ageMax),
      discovery_regions: textArray(d.regions),
      discovery_statuses: textArray(d.statuses),
      discovery_income_bracket_min: lit(d.incomeBracketMin),
      discovery_income_bracket_max: lit(d.incomeBracketMax),
      discovery_housing_types: textArray(d.housingTypes),
      source_url: lit(p.sourceUrl),
      apply_url: lit(p.applyUrl),
      youth_policy_no: lit(p.youthPolicyNo),
      gov24_service_id: lit(p.gov24ServiceId),
      notes: lit(p.notes),
      edit_note: lit(IMPORT_NOTE),
    })
  );
});

out.push("", "-- ── 대출·보증 상품 ──");
loanProducts.forEach((l, i) => {
  out.push(
    insert("data_loan_products", {
      id: lit(l.id),
      status: lit("published"),
      sort_order: lit((i + 1) * 10),
      name: lit(l.name),
      agency: lit(l.agency),
      region_scope: lit(l.regionScope),
      effective_year: lit(l.effectiveYear),
      product_type: lit(l.productType),
      summary: lit(l.summary),
      source_url: lit(l.sourceUrl),
      apply_url: lit(l.applyUrl),
      notes: lit(l.notes),
      edit_note: lit(IMPORT_NOTE),
    })
  );
});

out.push("", "-- ── 옛 검수 기록 (JSON 의 verifiedAt) ──");
for (const p of policies) {
  if (p.verifiedAt) out.push(legacyReview("policy_id", p.id, p.verifiedAt, p.sourceUrl));
}
for (const l of loanProducts) {
  if (l.verifiedAt) out.push(legacyReview("loan_product_id", l.id, l.verifiedAt, l.sourceUrl));
}

out.push("", "select set_config('perky.import_mode', 'off', false);", "");

const target = join(here, "seed.sql");
writeFileSync(target, out.join("\n"), "utf8");
console.log(
  `seed.sql 작성: 정책 ${policies.length} · 상품 ${loanProducts.length} · 소득구간 ${incomeBrackets.length} · 중위소득 ${sizes.length}인까지`
);
