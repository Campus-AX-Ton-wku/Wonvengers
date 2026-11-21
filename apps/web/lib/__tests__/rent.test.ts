import { describe, expect, it } from "vitest";
import { monthlyRentEquivalent, nominalTotalCost } from "../rent";
import { makeListing } from "./fixtures";

describe("monthlyRentEquivalent", () => {
  it("월세는 그대로 반환한다", () => {
    expect(monthlyRentEquivalent(makeListing({ contractType: "월세", rentOrYearlyAmount: 350000 }))).toBe(350000);
  });

  it("연세는 1년(12개월) 치로 보고 12로 나눠 환산한다 — 24개월 살아도 같다 (11/21 ggue)", () => {
    expect(monthlyRentEquivalent(makeListing({ contractType: "연세", rentOrYearlyAmount: 4800000, months: 12 }))).toBe(400000);
    expect(monthlyRentEquivalent(makeListing({ contractType: "연세", rentOrYearlyAmount: 4800000, months: 24 }))).toBe(400000);
  });
});

describe("nominalTotalCost", () => {
  // 11/21 (ggue): '최대 12개월' 규칙을 없앴다 — 계약이 24개월일 수도 있으니 입력한 개월 수 그대로 센다
  it("(월 환산 임대료 + 관리비) × 입력한 개월수 + 일시지출로 계산한다 — 24개월이면 24개월", () => {
    const listing = makeListing({
      contractType: "월세",
      rentOrYearlyAmount: 300000,
      managementFee: 50000,
      months: 24,
      oneTimeMoveCost: 200000,
    });
    expect(nominalTotalCost(listing)).toBe((300000 + 50000) * 24 + 200000);
  });
});
