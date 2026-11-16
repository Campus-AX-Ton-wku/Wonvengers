// Supabase 공개 정책 목록(public.app_policies()) → 앱 데이터 JSON 3개.
//
// 설계: docs/기획/2026-11-16-정책-Supabase-읽기-설계.md "2. DB → 앱 JSON 변환"
// 이 파일은 순수 함수만 둔다(네트워크·파일 없음) — scripts/fetch-app-data.mjs 가 부르고,
// scripts/__tests__/app-data-from-db.test.mjs 가 검사한다.
//
// 규칙
//   - benefit_type 이 있으면 금액 계산 정책(policies.json · PolicyMeta), 없으면 안내 상품(loan-products.json · LoanProductMeta).
//   - 값을 지어내지 않는다(F0-5). 앱 타입이 비울 수 없는 칸이 DB 에서 비어 있으면 고치는 방법과 함께 오류로 알린다.
//   - 내부 메모(notes)는 앱에 싣지 않는다("") — DB 의 notes 가 그 자리다.
//   - 확인일(verifiedAt)은 확인 기록(⑤)의 이 버전 마지막 '일치'가 우선, 없으면 DB 의 verified_at.

/** DB 지역 코드 → 앱 지역 이름(regionScope · discovery.regions). lib/region.ts 의 어휘와 같다(테스트가 확인). */
export const REGION_BY_CODE = {
  "00": "전국",
  "52": "전북특별자치도",
  "52140": "전북특별자치도 익산시",
};

/** 안내 상품 종류 (DB kind → LoanProductMeta.productType) */
export const PRODUCT_TYPE_BY_KIND = {
  대출: "loan_interest_subsidy",
  보증료: "guarantee_fee_subsidy",
  저축: "savings_account",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//;

function contactOf(row) {
  const c = row.contact;
  if (!c) return null;
  const base = c.department ? `${c.name} ${c.department}` : c.name;
  return {
    department: row.contact_label ?? base,
    phone: c.phone ?? null,
    url: row.contact_url ?? c.homepage ?? null,
    phoneCheckedAt: c.verified_at ?? null,
  };
}

const verifiedAtOf = (row) => row.checks?.last_confirmed_at ?? row.verified_at ?? null;

function toPolicy(row) {
  const out = {
    id: row.policy_no,
    name: row.name,
    agency: row.agency,
    regionScope: row.region_label,
    applicationStart: row.apply_start,
    applicationEnd: row.apply_end,
    benefitType: row.benefit_type,
    benefitSummary: row.summary,
  };
  // 값이 있을 때만 싣는 칸 — 앱 JSON 도 없는 칸은 아예 적지 않는다
  if (row.monthly_cap != null) out.monthlyCap = row.monthly_cap;
  if (row.max_months != null) out.maxMonths = row.max_months;
  if (row.lump_sum_cap != null) out.lumpSumCap = row.lump_sum_cap;
  if (row.lump_sum_basis != null) out.lumpSumBasis = row.lump_sum_basis;
  if (row.payout_note != null) out.payoutNote = row.payout_note;
  Object.assign(out, {
    requiredInputs: row.required_inputs ?? [],
    exclusiveGroup: row.exclusive_groups ?? [],
    sourceUrl: row.source_url,
    applyUrl: row.apply_url,
    youthPolicyNo: row.youth_policy_no ?? null,
    gov24ServiceId: row.gov24_service_id ?? null,
    verifiedAt: verifiedAtOf(row),
    effectiveYear: row.year,
    notes: "",
    contact: contactOf(row),
    nextRound: row.next_round ?? null,
    discovery: {
      ageMin: row.age_min,
      ageMax: row.age_max,
      regions: [row.region_label],
      statuses: row.statuses,
      incomeBracketMin: row.income_bracket_min,
      incomeBracketMax: row.income_bracket_max,
      housingTypes: row.housing_types,
    },
  });
  return out;
}

function toProduct(row) {
  return {
    id: row.policy_no,
    name: row.name,
    agency: row.agency,
    regionScope: row.region_label,
    productType: PRODUCT_TYPE_BY_KIND[row.kind],
    summary: row.summary,
    sourceUrl: row.source_url,
    applyUrl: row.apply_url,
    verifiedAt: verifiedAtOf(row),
    effectiveYear: row.year,
    notes: "",
    contact: contactOf(row),
    nextRound: row.next_round ?? null,
  };
}

/** 검수 배지용 (lib/verification.ts 의 VerificationSnapshot). 예전 scripts/verification-snapshot.sql 결과와 같은 모양. */
function toVerification(rows, generatedAt) {
  return {
    generatedAt,
    source: "Supabase perky — public.app_policies() (공개 상태 정책만)",
    policies: Object.fromEntries(
      rows.map((r) => [
        r.policy_no,
        {
          trustLevel: r.trust_level,
          version: r.version,
          confirmers: r.checks?.confirmers ?? 0,
          lastConfirmedAt: r.checks?.last_confirmed_at ?? null,
          methods: r.checks?.methods ?? [],
          sourceUrl: r.source_url,
          values: {
            summary: r.summary,
            applyStart: r.apply_start,
            applyEnd: r.apply_end,
            ageMin: r.age_min,
            ageMax: r.age_max,
            statuses: r.statuses,
            incomeBracketMin: r.income_bracket_min,
            incomeBracketMax: r.income_bracket_max,
            housingTypes: r.housing_types,
            monthlyCap: r.monthly_cap,
            maxMonths: r.max_months,
            lumpSumCap: r.lump_sum_cap,
          },
        },
      ])
    ),
  };
}

/**
 * DB 행을 검사한다. 오류 문구는 팀원이 Supabase Table Editor 에서 무엇을 고치면 되는지 말한다.
 * @returns {string[]} 오류 목록 (비었으면 통과)
 */
export function validateRows(rows) {
  const errors = [];
  if (!Array.isArray(rows)) return ["app_policies() 결과가 배열이 아니다"];
  if (rows.length === 0) errors.push("공개 정책이 0건이다 — DB 가 비었거나 함수가 바뀌었다. 빈 앱을 배포하지 않는다");
  const seen = new Set();
  for (const r of rows) {
    const at = `[${r?.policy_no ?? "?"}]`;
    const need = (cond, msg) => { if (!cond) errors.push(`${at} ${msg}`); };
    need(typeof r.policy_no === "string" && r.policy_no !== "", "정책 번호(policy_no)가 없다");
    need(!seen.has(r.policy_no), "정책 번호가 두 번 나온다 — 현재 회차(is_current)가 하나인지 확인");
    seen.add(r.policy_no);
    need(typeof r.name === "string" && r.name.trim() !== "", "이름(name)이 비었다");
    need(typeof r.summary === "string" && r.summary.trim() !== "", "요약(summary)이 비었다");
    need(typeof r.agency === "string" && r.agency !== "", "시행처(agency_id)가 없다");
    need(URL_RE.test(r.source_url ?? ""), "원문 주소(source_url)가 http 로 시작하지 않는다");
    need(URL_RE.test(r.apply_url ?? ""), "신청 주소(apply_url)가 비었다 — 신청 창구 주소를 적는다(없으면 원문 주소)");
    need(Array.isArray(r.region_codes) && r.region_codes.length === 1,
      "지역 코드(region_codes)는 하나여야 한다 — 앱은 정책마다 지역 하나만 다룬다");
    const label = REGION_BY_CODE[r.region_codes?.[0]];
    need(label !== undefined, `앱이 모르는 지역 코드 ${r.region_codes?.[0]} — 앱 지역 목록(lib/region.ts)과 변환표(REGION_BY_CODE)에 먼저 넣는다`);
    need(label === undefined || r.region_label === label, `지역 이름(region_label)이 코드와 다르다 — '${label}' 로 적는다`);
    need(Number.isInteger(r.year), "사업 연도(year)가 없다");
    for (const k of ["apply_start", "apply_end", "verified_at"]) {
      need(r[k] == null || DATE.test(r[k]), `${k} 가 YYYY-MM-DD 가 아니다`);
    }
    if (r.benefit_type != null) {
      need(r.apply_start != null, "신청 시작일(apply_start)이 비었다 — 상시 접수면 사업 연도 1월 1일로 적는다");
      need(r.lump_sum_basis != null || r.benefit_type !== "lump_sum", "일시금(lump_sum)인데 계산 방식(lump_sum_basis)이 없다");
    } else {
      need(PRODUCT_TYPE_BY_KIND[r.kind] !== undefined,
        `지원 형태(benefit_type)가 없는 '${r.kind}' — 앱은 대출·보증료·저축만 안내 상품으로 보여 준다`);
    }
  }
  return errors;
}

/**
 * @param {unknown[]} rows public.app_policies() 결과
 * @param {{ generatedAt: string }} opts
 */
export function toAppData(rows, { generatedAt }) {
  const errors = validateRows(rows);
  if (errors.length) {
    const e = new Error(`DB 정책 데이터 검사 실패 ${errors.length}건\n  - ${errors.join("\n  - ")}`);
    e.errors = errors;
    throw e;
  }
  return {
    policies: rows.filter((r) => r.benefit_type != null).map(toPolicy),
    loanProducts: rows.filter((r) => r.benefit_type == null).map(toProduct),
    verification: toVerification(rows, generatedAt),
  };
}

/** 커밋하는 JSON 과 같은 글자 모양 (2칸 들여쓰기 + 마지막 줄바꿈) */
export const formatJson = (value) => JSON.stringify(value, null, 2) + "\n";
