import { describe, expect, it } from "vitest";
import {
  REGION_HIERARCHY,
  REGION_OPTIONS,
  housingSupplyForRegion,
  isRegionValue,
  loanProductsForRegion,
  policiesForRegion,
  policyAppliesToRegion,
} from "@/lib/region";
import type { HousingSupplyMeta, LoanProductMeta, PolicyMeta } from "@/lib/types";

/**
 * REGION_OPTIONS 가 REGION_HIERARCHY 계층 구조로 바뀌었다 (전국화 Phase 0).
 * 이 테스트는 두 가지를 고정한다:
 *
 *  1. 기존 3개 선택지(값·순서·라벨)가 리팩터링 전과 완전히 같다 — 저장된 익산
 *     사용자의 answers.region 문자열, find.test.tsx 의 버튼 라벨 텍스트,
 *     policyAppliesToRegion 의 매칭 규칙이 전부 이 값에 기대고 있다.
 *  2. REGION_HIERARCHY 에 시도를 추가하면 REGION_OPTIONS 가 그 값을 그대로
 *     반영한다 — 향후 지역을 늘릴 때 "이 파일만 고치면 된다"는 것을 보장한다.
 */
describe("지역 선택지 계층 구조", () => {
  it("기존 전북 3개 선택지(값·순서·라벨)는 서울 추가 후에도 그대로다", () => {
    // 저장된 익산 사용자의 answers.region 문자열, find.test.tsx 의 버튼 라벨
    // 텍스트가 이 세 값에 기대고 있다 — 순서 안에서의 상대 위치까지 고정한다.
    expect(REGION_OPTIONS.slice(0, 3)).toEqual([
      { value: "전북특별자치도 익산시", label: "전북특별자치도 익산시", chipLabel: "익산시" },
      { value: "전북특별자치도", label: "전북특별자치도 (익산시 외)", chipLabel: "전북 (익산시 외)" },
      { value: "서울특별시", label: "서울특별시", chipLabel: "서울" },
    ]);
    expect(REGION_OPTIONS[REGION_OPTIONS.length - 1]).toEqual({
      value: "그 외 지역",
      label: "그 외 지역 (전국 정책만 해당)",
      chipLabel: "그 외 지역",
    });
  });

  it("REGION_OPTIONS 는 REGION_HIERARCHY 를 [시군구..., catchAll] 순으로 펼치고 '그 외 지역'을 마지막에 붙인 것과 같다", () => {
    const expected = [
      ...REGION_HIERARCHY.flatMap((p) => [...p.districts, p.catchAll]),
      REGION_OPTIONS[REGION_OPTIONS.length - 1], // '그 외 지역' — 시도 어디에도 없다
    ];
    expect(REGION_OPTIONS).toEqual(expected);
    expect(REGION_OPTIONS[REGION_OPTIONS.length - 1].value).toBe("그 외 지역");
  });

  it("모든 시도의 catchAll.value 는 시도 정식명과 같다 — 시도 단위 정책이 이 값으로 매칭된다", () => {
    for (const province of REGION_HIERARCHY) {
      expect(province.catchAll.value).toBe(province.name);
    }
  });

  it("모든 시군구의 value 는 소속 시도 이름으로 시작한다 — 상위 지자체 매칭(policyAppliesToRegion)이 깨지지 않는다", () => {
    for (const province of REGION_HIERARCHY) {
      for (const district of province.districts) {
        expect(district.value.startsWith(province.name)).toBe(true);
      }
    }
  });

  it("REGION_OPTIONS 안에 값 중복이 없다", () => {
    const values = REGION_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("isRegionValue", () => {
  it("기존 익산 사용자의 저장값을 그대로 인식한다", () => {
    expect(isRegionValue("전북특별자치도 익산시")).toBe(true);
    expect(isRegionValue("전북특별자치도")).toBe(true);
    expect(isRegionValue("그 외 지역")).toBe(true);
  });

  it("선택지에 없는 자유 입력은 걸러낸다", () => {
    expect(isRegionValue("익산")).toBe(false);
    expect(isRegionValue("경기도")).toBe(false);
    expect(isRegionValue("")).toBe(false);
  });
});

describe("policyAppliesToRegion — 회귀 확인", () => {
  it("전국 정책은 어떤 지역 값에도 적용된다", () => {
    expect(policyAppliesToRegion("전국", "전북특별자치도 익산시")).toBe(true);
    expect(policyAppliesToRegion("전국", "그 외 지역")).toBe(true);
  });

  it("시군구 사용자는 소속 시도 정책도 받는다", () => {
    expect(policyAppliesToRegion("전북특별자치도", "전북특별자치도 익산시")).toBe(true);
  });

  it("시도(익산시 외) 사용자는 시군구 전용 정책을 받지 않는다", () => {
    expect(policyAppliesToRegion("전북특별자치도 익산시", "전북특별자치도")).toBe(false);
  });

  it("지역이 없으면(빈 문자열) 전국 정책 외에는 적용되지 않는다", () => {
    expect(policyAppliesToRegion("전북특별자치도", "")).toBe(false);
  });
});

describe("policiesForRegion — 회귀 확인", () => {
  const 전국정책: PolicyMeta = {
    id: "test-national",
    name: "테스트 전국 정책",
    agency: "국토교통부",
    regionScope: "전국",
    discovery: {
      ageMin: null,
      ageMax: null,
      regions: ["전국"],
      statuses: null,
      incomeBracketMin: null,
      incomeBracketMax: null,
      housingTypes: null,
    },
    applicationStart: "2026-01-01",
    applicationEnd: null,
    benefitType: "flat_monthly",
    benefitSummary: "테스트",
    requiredInputs: [],
    exclusiveGroup: [],
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com",
    youthPolicyNo: null,
    gov24ServiceId: null,
    verifiedAt: "2026-01-01",
    effectiveYear: 2026,
    notes: "테스트",
  };

  it("등록된 시도가 하나도 없는 '그 외 지역' 사용자도 전국 정책은 받는다", () => {
    const ids = policiesForRegion([전국정책], "그 외 지역").map((p) => p.id);
    expect(ids).toContain("test-national");
  });

  it("서울 광역 정책(전국화 Phase 2)도 같은 규칙으로 걸러진다 — 시도 확장이 매칭 로직을 안 건드린다", () => {
    const 서울정책: PolicyMeta = { ...전국정책, id: "test-seoul", regionScope: "서울특별시" };
    expect(policiesForRegion([서울정책], "서울특별시").map((p) => p.id)).toEqual(["test-seoul"]);
    expect(policiesForRegion([서울정책], "그 외 지역")).toEqual([]);
    expect(policiesForRegion([서울정책], "전북특별자치도 익산시")).toEqual([]);
  });
});

/**
 * loanProductsForRegion — 결과 화면이 loan-products.json 을 지역 구분 없이 통째로
 * 보여주던 버그의 회귀 테스트다. policyAppliesToRegion 을 policiesForRegion 과
 * 그대로 공유하므로, 매칭 규칙 자체는 위 "policyAppliesToRegion — 회귀 확인"이
 * 이미 검증한다 — 여기서는 LoanProductMeta 에도 같은 필터가 적용되는지만 본다.
 */
describe("loanProductsForRegion — 회귀 확인", () => {
  const 대출상품 = (overrides: Partial<LoanProductMeta>): LoanProductMeta => ({
    id: "test-loan",
    name: "테스트 대출상품",
    agency: "테스트기관",
    regionScope: "전국",
    productType: "loan_interest_subsidy",
    summary: "테스트",
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com",
    verifiedAt: null,
    effectiveYear: 2026,
    notes: "테스트",
    ...overrides,
  });

  const 전국상품 = 대출상품({ id: "national-loan", regionScope: "전국" });
  const 익산상품 = 대출상품({ id: "iksan-loan", regionScope: "전북특별자치도 익산시" });
  const 군산상품 = 대출상품({ id: "gunsan-loan", regionScope: "전북특별자치도 군산시" });
  const 전상품 = [전국상품, 익산상품, 군산상품];

  it("익산 사용자에게는 전국 상품과 익산 상품만 보이고, 군산 상품은 안 보인다", () => {
    const ids = loanProductsForRegion(전상품, "전북특별자치도 익산시").map((p) => p.id);
    expect(ids).toContain("national-loan");
    expect(ids).toContain("iksan-loan");
    expect(ids).not.toContain("gunsan-loan");
  });

  it("익산·군산 어디에도 속하지 않는 '그 외 지역' 사용자에게는 전국 상품만 보인다", () => {
    const ids = loanProductsForRegion(전상품, "그 외 지역").map((p) => p.id);
    expect(ids).toEqual(["national-loan"]);
  });

  it("전북(익산시 외) 사용자에게는 시군구 전용 상품이 안 보인다 — policiesForRegion 과 같은 규칙", () => {
    const ids = loanProductsForRegion(전상품, "전북특별자치도").map((p) => p.id);
    expect(ids).toEqual(["national-loan"]);
  });
});

/**
 * housingSupplyForRegion — loan-products.json 을 위해 만든 지역 필터를 그대로
 * 재사용하는지 확인한다. 새 안내 전용 목록을 추가할 때마다 규칙을 새로 만들지
 * 않는다는 게 이 함수를 만든 이유이므로, loanProductsForRegion 과 똑같은
 * 세 가지 케이스를 그대로 반복한다.
 */
describe("housingSupplyForRegion — 회귀 확인", () => {
  const 주택공급 = (overrides: Partial<HousingSupplyMeta>): HousingSupplyMeta => ({
    id: "test-housing",
    name: "테스트 저가 주택 공급",
    agency: "테스트기관",
    regionScope: "전국",
    location: "테스트 위치",
    monthlyRentMin: 10000,
    monthlyRentMax: 20000,
    deposit: 500000,
    capacityLabel: "10호",
    applicationStart: null,
    applicationEnd: null,
    applicationPeriodNote: null,
    summary: "테스트",
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com",
    verifiedAt: null,
    effectiveYear: 2026,
    notes: "테스트",
    ...overrides,
  });

  const 전국공급 = 주택공급({ id: "national-housing", regionScope: "전국" });
  const 전주공급 = 주택공급({ id: "jeonju-housing", regionScope: "전북특별자치도 전주시" });
  const 군산공급 = 주택공급({ id: "gunsan-housing", regionScope: "전북특별자치도 군산시" });
  const 전체 = [전국공급, 전주공급, 군산공급];

  it("전주 사용자에게는 전국 공급과 전주 공급만 보이고, 군산 공급은 안 보인다", () => {
    const ids = housingSupplyForRegion(전체, "전북특별자치도 전주시").map((p) => p.id);
    expect(ids).toContain("national-housing");
    expect(ids).toContain("jeonju-housing");
    expect(ids).not.toContain("gunsan-housing");
  });

  it("전주·군산 어디에도 속하지 않는 '그 외 지역' 사용자에게는 전국 공급만 보인다", () => {
    const ids = housingSupplyForRegion(전체, "그 외 지역").map((p) => p.id);
    expect(ids).toEqual(["national-housing"]);
  });

  it("전북(익산시 외) 사용자에게는 시군구 전용 공급이 안 보인다", () => {
    const ids = housingSupplyForRegion(전체, "전북특별자치도").map((p) => p.id);
    expect(ids).toEqual(["national-housing"]);
  });
});
