import { describe, expect, it } from "vitest";
import {
  REGION_HIERARCHY,
  REGION_OPTIONS,
  housingSupplyForRegion,
  isRegionValue,
  loanProductsForRegion,
  policiesForRegion,
  policyAppliesToRegion,
  provinceForRegion,
} from "@/lib/region";
import policiesData from "@/data/policies.json";
import type { HousingSupplyMeta, LoanProductMeta, PolicyMeta } from "@/lib/types";

const policies = policiesData as PolicyMeta[];

describe("전국 시도·시군구 계층", () => {
  it("17개 시도를 먼저 제공하고 모든 시도에 하위 선택지가 있다", () => {
    expect(REGION_HIERARCHY).toHaveLength(17);
    for (const province of REGION_HIERARCHY) {
      expect(province.districts.length, province.name).toBeGreaterThan(0);
    }
  });

  it("평탄화한 지역값은 중복이 없고 소속 시도를 다시 찾을 수 있다", () => {
    const values = REGION_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(isRegionValue(value), value).toBe(true);
      expect(provinceForRegion(value), value).not.toBeNull();
    }
  });

  it("익산시와 세종시 전체 값을 지원한다", () => {
    expect(isRegionValue("전북특별자치도 익산시")).toBe(true);
    expect(isRegionValue("세종특별자치시")).toBe(true);
    expect(provinceForRegion("전북특별자치도 익산시")?.name).toBe("전북특별자치도");
  });

  it("2026년 7월 개편 전 인천 구명은 빼고 새 구명을 제공한다", () => {
    for (const district of ["제물포구", "영종구", "서해구", "검단구"]) {
      expect(isRegionValue(`인천광역시 ${district}`)).toBe(true);
    }
    for (const district of ["중구", "동구", "서구"]) {
      expect(isRegionValue(`인천광역시 ${district}`)).toBe(false);
    }
  });
});

describe("지역 정책 매칭", () => {
  it("시군구 사용자는 전국·소속 시도·해당 시군구 정책을 받는다", () => {
    expect(policyAppliesToRegion("전국", "전북특별자치도 익산시")).toBe(true);
    expect(policyAppliesToRegion("전북특별자치도", "전북특별자치도 익산시")).toBe(true);
    expect(policyAppliesToRegion("전북특별자치도 익산시", "전북특별자치도 익산시")).toBe(true);
  });

  it("다른 시군구 전용 정책은 섞이지 않는다", () => {
    const ids = policiesForRegion(policies, "전북특별자치도 전주시").map((policy) => policy.id);
    expect(ids).toContain("jeonbuk-youth-settlement-support");
    expect(ids).not.toContain("iksan-youth-rent-support");
  });
});

describe("안내 상품 지역 매칭", () => {
  const loan = (id: string, regionScope: string): LoanProductMeta => ({
    id,
    name: id,
    agency: "테스트기관",
    regionScope,
    productType: "loan_interest_subsidy",
    summary: "테스트",
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com",
    verifiedAt: null,
    effectiveYear: 2026,
    notes: "테스트",
  });

  it("대출·보증 상품도 같은 지역 규칙으로 거른다", () => {
    const products = [
      loan("national", "전국"),
      loan("iksan", "전북특별자치도 익산시"),
      loan("gunsan", "전북특별자치도 군산시"),
    ];
    expect(loanProductsForRegion(products, "전북특별자치도 익산시").map((item) => item.id)).toEqual([
      "national",
      "iksan",
    ]);
  });

  it("저가 주택 공급도 같은 지역 규칙으로 거른다", () => {
    const housing = (id: string, regionScope: string): HousingSupplyMeta => ({
      id,
      name: id,
      agency: "테스트기관",
      regionScope,
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
    });
    const items = [housing("national", "전국"), housing("jeonju", "전북특별자치도 전주시")];
    expect(housingSupplyForRegion(items, "전북특별자치도 전주시").map((item) => item.id)).toEqual([
      "national",
      "jeonju",
    ]);
  });
});
