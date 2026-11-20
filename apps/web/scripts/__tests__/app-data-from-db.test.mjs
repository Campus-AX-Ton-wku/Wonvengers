import { describe, expect, it } from "vitest";
import { REGION_HIERARCHY, policyAppliesToRegion } from "../../lib/region";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ICON3D_NAMES, POLICY_ICONS as APP_POLICY_ICONS } from "../../lib/icons3d";
import { POLICY_ICONS, PRODUCT_TYPE_BY_KIND, REGION_BY_CODE, formatJson, toAppData, validateRows } from "../app-data/from-db.mjs";

/**
 * Supabase public.app_policies() 한 행 (2026-11-16 실제 응답에서 값만 줄인 것).
 * 덮어쓸 칸만 넘기면 나머지는 통과하는 행이 된다.
 */
const row = (over = {}) => ({
  policy_no: "iksan-youth-rent-support",
  year: 2026,
  version: 2,
  kind: "현금",
  status: "운영",
  name: "익산형 청년월세 지원사업",
  icon: "rent",
  summary: "월 최대 20만원 × 최대 12개월",
  source_url: "https://www.iksan.go.kr/a",
  apply_url: "https://www.iksan.go.kr/b",
  apply_start: "2026-04-15",
  apply_end: "2026-09-30",
  next_round: null,
  age_min: 19,
  age_max: 39,
  age_military_extension: null,
  region_codes: ["52140"],
  region_label: "전북특별자치도 익산시",
  statuses: ["대학생", "재직", "구직"],
  income_bracket_min: null,
  income_bracket_max: 5,
  housing_types: ["월세"],
  benefit_type: "rent_capped_monthly",
  monthly_cap: 200000,
  max_months: 12,
  lump_sum_cap: null,
  lump_sum_basis: null,
  payout_note: null,
  documents: null,
  exclusive_groups: ["youth-rent"],
  required_inputs: ["rent"],
  youth_policy_no: "20260326005400212297",
  gov24_service_id: null,
  trust_level: "미검수",
  checked_at: null,
  verified_at: "2026-11-03",
  agency: "익산시",
  contact: { name: "익산시", department: "주택과", phone: "063-859-5909", homepage: null, verified_at: null },
  contact_label: null,
  contact_url: "https://www.iksan.go.kr/c",
  checks: { confirmers: 0, last_confirmed_at: null, methods: [] },
  ...over,
});

const loan = (over = {}) =>
  row({
    policy_no: "youth-btm-jeonse-loan",
    kind: "대출",
    icon: "loan",
    benefit_type: null,
    monthly_cap: null,
    max_months: null,
    region_codes: ["00"],
    region_label: "전국",
    ...over,
  });

const at = { generatedAt: "2026-11-16T12:00:00+09:00" };

describe("toAppData — 나누기", () => {
  it("지원 형태가 있으면 지원금, 없으면 안내 상품", () => {
    const out = toAppData([row(), loan()], at);
    expect(out.policies.map((p) => p.id)).toEqual(["iksan-youth-rent-support"]);
    expect(out.loanProducts.map((p) => p.id)).toEqual(["youth-btm-jeonse-loan"]);
    expect(out.loanProducts[0].productType).toBe("loan_interest_subsidy");
  });

  it("'보증료'라도 지원 형태가 있으면 지원금이다 (보증금반환보증 보증료 지원)", () => {
    const out = toAppData(
      [row({ policy_no: "jeonse-return-guarantee-fee-subsidy", kind: "보증료", benefit_type: "lump_sum", lump_sum_basis: "notCalculable" })],
      at
    );
    expect(out.policies[0]).toMatchObject({ benefitType: "lump_sum", lumpSumBasis: "notCalculable" });
    expect(out.loanProducts).toEqual([]);
  });

  it("DB 순서를 그대로 지킨다", () => {
    const out = toAppData([row({ policy_no: "b" }), row({ policy_no: "a" })], at);
    expect(out.policies.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("toAppData — 칸 옮기기", () => {
  it("지원금 한 건의 모양 (앱 JSON 과 같은 칸 순서)", () => {
    const [p] = toAppData([row()], at).policies;
    expect(Object.keys(p)).toEqual([
      "id", "name", "icon", "agency", "regionScope", "applicationStart", "applicationEnd", "benefitType", "benefitSummary",
      "monthlyCap", "maxMonths", "requiredInputs", "exclusiveGroup", "sourceUrl", "applyUrl", "youthPolicyNo",
      "gov24ServiceId", "verifiedAt", "effectiveYear", "notes", "contact", "nextRound", "discovery",
    ]);
    expect(p.discovery).toEqual({
      ageMin: 19, ageMax: 39, regions: ["전북특별자치도 익산시"], statuses: ["대학생", "재직", "구직"],
      incomeBracketMin: null, incomeBracketMax: 5, housingTypes: ["월세"],
    });
  });

  it("값이 없는 선택 칸은 아예 적지 않는다", () => {
    const [p] = toAppData([row({ monthly_cap: null, max_months: null })], at).policies;
    expect("monthlyCap" in p).toBe(false);
    expect("lumpSumCap" in p).toBe(false);
    expect("payoutNote" in p).toBe(false);
  });

  it("내부 메모는 싣지 않는다", () => {
    const out = toAppData([row(), loan()], at);
    expect(out.policies[0].notes).toBe("");
    expect(out.loanProducts[0].notes).toBe("");
  });

  it("문의처 — 정책 칸이 있으면 그것, 없으면 기관 표", () => {
    const [p] = toAppData([row()], at).policies;
    expect(p.contact).toEqual({ department: "익산시 주택과", phone: "063-859-5909", url: "https://www.iksan.go.kr/c", phoneCheckedAt: null });
    const [q] = toAppData([row({ contact_label: "익산시청 기획예산과", contact_url: null, contact: { name: "익산시", department: "", phone: null, homepage: "https://h", verified_at: "2026-11-03" } })], at).policies;
    expect(q.contact).toEqual({ department: "익산시청 기획예산과", phone: null, url: "https://h", phoneCheckedAt: "2026-11-03" });
    expect(toAppData([row({ contact: null })], at).policies[0].contact).toBeNull();
  });

  it("확인일 — 이 버전의 확인 기록이 있으면 그 날짜가 우선", () => {
    expect(toAppData([row()], at).policies[0].verifiedAt).toBe("2026-11-03");
    const checked = row({ checks: { confirmers: 1, last_confirmed_at: "2026-11-14", methods: ["원문대조"] } });
    expect(toAppData([checked], at).policies[0].verifiedAt).toBe("2026-11-14");
    expect(toAppData([row({ verified_at: null })], at).policies[0].verifiedAt).toBeNull();
  });
});

describe("toAppData — 검수 파일 (lib/verification.ts)", () => {
  it("정책마다 신뢰도 · 확인 인원 · 견줄 값", () => {
    const v = toAppData([row({ trust_level: "검수", checks: { confirmers: 1, last_confirmed_at: "2026-11-14", methods: ["전화문의"] } })], at).verification;
    expect(v.generatedAt).toBe(at.generatedAt);
    expect(v.policies["iksan-youth-rent-support"]).toMatchObject({
      trustLevel: "검수", version: 2, confirmers: 1, lastConfirmedAt: "2026-11-14", methods: ["전화문의"],
      values: { summary: "월 최대 20만원 × 최대 12개월", applyStart: "2026-04-15", monthlyCap: 200000, lumpSumCap: null },
    });
  });
});

describe("validateRows — 빈 앱이나 틀린 값을 배포하지 않는다", () => {
  const errorsOf = (rows) => validateRows(rows).join("\n");

  it("통과하는 행", () => {
    expect(validateRows([row(), loan()])).toEqual([]);
  });

  it("0건이면 멈춘다", () => {
    expect(errorsOf([])).toContain("0건");
  });

  it("같은 정책 번호가 두 번", () => {
    expect(errorsOf([row(), row()])).toContain("두 번");
  });

  it("지원금인데 신청 시작일이 비었다 — 지어내지 않고 고치는 방법을 알린다", () => {
    expect(errorsOf([row({ apply_start: null })])).toContain("상시 접수면 사업 연도 1월 1일");
  });

  it("앱이 모르는 지역 코드 · 코드와 다른 지역 이름", () => {
    expect(errorsOf([row({ region_codes: ["11"] })])).toContain("앱이 모르는 지역 코드 11");
    expect(errorsOf([row({ region_label: "익산시" })])).toContain("'전북특별자치도 익산시' 로 적는다");
  });

  it("앱이 보여 줄 곳이 없는 종류 (임대)", () => {
    expect(errorsOf([loan({ kind: "임대" })])).toContain("'임대'");
  });

  it("신청 주소 · 원문 주소", () => {
    expect(errorsOf([row({ apply_url: null })])).toContain("신청 주소");
    expect(errorsOf([row({ source_url: "www.x" })])).toContain("원문 주소");
  });

  it("일시금인데 계산 방식이 없다", () => {
    expect(errorsOf([row({ benefit_type: "lump_sum", lump_sum_basis: null })])).toContain("lump_sum_basis");
  });

  it("toAppData 는 검사 실패면 던진다", () => {
    expect(() => toAppData([row({ name: " " })], at)).toThrow(/이름\(name\)/);
  });
});

describe("변환표가 앱 어휘와 맞다", () => {
  it("지역 이름은 lib/region.ts 의 시·도 또는 시·군·구다", () => {
    const districts = REGION_HIERARCHY.flatMap((p) => p.districts.map((d) => d.value));
    for (const label of Object.values(REGION_BY_CODE)) {
      // '전국'과 시·도는 그 아래 시·군·구에 적용되고, 시·군·구는 자기 자신이다
      expect(districts.some((d) => policyAppliesToRegion(label, d))).toBe(true);
    }
  });

  it("안내 상품 종류는 LoanProductMeta.productType 값이다", () => {
    expect(Object.values(PRODUCT_TYPE_BY_KIND).sort()).toEqual(["guarantee_fee_subsidy", "loan_interest_subsidy", "savings_account"]);
  });

  it("커밋하는 JSON 모양 — 2칸 들여쓰기 + 마지막 줄바꿈", () => {
    expect(formatJson([{ a: 1 }])).toBe('[\n  {\n    "a": 1\n  }\n]\n');
  });
});

describe("서류 목록 (documents)", () => {
  it("있으면 payoutNote 다음에 싣고, 없으면 칸을 적지 않는다", () => {
    const docs = [{ name: "임대차계약서 사본", note: "확정일자 포함" }, { name: "주민등록등본" }];
    const [withDocs] = toAppData([row({ documents: docs })], at).policies;
    expect(withDocs.documents).toEqual(docs);
    const keys = Object.keys(withDocs);
    expect(keys.indexOf("documents")).toBe(keys.indexOf("requiredInputs") - 1);
    const [plain] = toAppData([row()], at).policies;
    expect("documents" in plain).toBe(false);
  });

  it("안내 상품에는 싣지 않는다", () => {
    const [loanItem] = toAppData([loan({ documents: [{ name: "a" }] })], at).loanProducts;
    expect("documents" in loanItem).toBe(false);
  });

  it("모양이 틀리면 빌드를 멈춘다", () => {
    expect(validateRows([row({ documents: [{ note: "x" }] })]).join("\n")).toContain("서류 목록(documents)");
    expect(validateRows([row({ documents: "a" })]).join("\n")).toContain("서류 목록(documents)");
    expect(validateRows([row({ documents: [{ name: "   " }] })]).join("\n")).toContain("서류 목록(documents)");
  });
});

describe("정책 종류 아이콘 (icon)", () => {
  it("지원금 · 안내 상품 모두 이름 다음에 싣는다", () => {
    const out = toAppData([row(), loan()], at);
    expect(out.policies[0].icon).toBe("rent");
    expect(Object.keys(out.loanProducts[0]).slice(0, 3)).toEqual(["id", "name", "icon"]);
    expect(out.loanProducts[0].icon).toBe("loan");
  });

  it("비었거나 앱이 모르는 이름이면 빌드를 멈추고 고칠 칸을 알린다", () => {
    expect(validateRows([row({ icon: null })]).join("\n")).toContain("아이콘(icon)이 비었다");
    expect(validateRows([row({ icon: "calculator" })]).join("\n")).toContain("앱이 모르는 아이콘 'calculator'");
  });

  it("고를 수 있는 이름 = 앱 lib/icons3d.ts 의 정책 종류 = DB enum, 그림 파일이 모두 있다", () => {
    expect(POLICY_ICONS).toEqual([...APP_POLICY_ICONS]);
    for (const name of POLICY_ICONS) expect(ICON3D_NAMES).toContain(name);
    for (const name of ICON3D_NAMES) expect(existsSync(join(__dirname, "..", "..", "public", "icons3d", `${name}.webp`))).toBe(true);
  });
});

describe("처음 올라온 때 (publishedAt, 11/20)", () => {
  it("있으면 싣고, 없으면 칸을 적지 않는다 — 지금 정책은 비어 있어 스냅숏이 그대로다", () => {
    const [withDate] = toAppData([row({ published_at: "2026-11-21T01:00:00+00:00" })], at).policies;
    expect(withDate.publishedAt).toBe("2026-11-21T01:00:00+00:00");
    const [without] = toAppData([row({ published_at: null })], at).policies;
    expect("publishedAt" in without).toBe(false);
    const [missing] = toAppData([row()], at).policies;
    expect("publishedAt" in missing).toBe(false);
  });

  it("안내 상품(대출)에는 싣지 않는다 — 알림은 지원금만", () => {
    const loan = toAppData([row({ kind: "대출", benefit_type: null, icon: "loan", published_at: "2026-11-21T01:00:00+00:00" })], at);
    expect("publishedAt" in loan.loanProducts[0]).toBe(false);
  });
});
