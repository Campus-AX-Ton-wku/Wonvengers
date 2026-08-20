import { describe, expect, it } from "vitest";
import { monthlyRentEquivalent, nominalTotalCost } from "../rent";
import { makeListing } from "./fixtures";

describe("monthlyRentEquivalent", () => {
  it("월세는 그대로 반환한다", () => {
    expect(monthlyRentEquivalent(makeListing({ contractType: "월세", rentOrYearlyAmount: 350000 }))).toBe(350000);
  });

  it("연세는 계약 개월 수로 나눠 환산한다 (F1-6)", () => {
    const listing = makeListing({ contractType: "연세", rentOrYearlyAmount: 4800000, months: 12 });
    expect(monthlyRentEquivalent(listing)).toBe(400000);
  });
});

describe("nominalTotalCost", () => {
  it("(월 환산 임대료 + 관리비) × 개월수 + 일시지출로 계산하고 최대 12개월까지만 반영한다", () => {
    const listing = makeListing({
      contractType: "월세",
      rentOrYearlyAmount: 300000,
      managementFee: 50000,
      months: 24,
      oneTimeMoveCost: 200000,
    });
    expect(nominalTotalCost(listing)).toBe((300000 + 50000) * 12 + 200000);
  });
});
