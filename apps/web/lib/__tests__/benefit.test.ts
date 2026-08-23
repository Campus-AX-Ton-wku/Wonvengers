import { describe, expect, it } from "vitest";
import policiesData from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import { benefitFormula, benefitTypeLabel, estimatePolicyAmount, payoutTiming } from "@/lib/benefit";
import { makeListing } from "./fixtures";

const policies = policiesData as PolicyMeta[];
const moland = policies.find((p) => p.id === "moland-youth-rent-support")!;
const jeonbuk = policies.find((p) => p.id === "jeonbuk-youth-settlement-support")!;
const iksanMoving = policies.find((p) => p.id === "iksan-newcomer-moving-cost-support")!;
const housingBenefit = policies.find((p) => p.id === "youth-housing-benefit-split-payment")!;

// F4-3: 결과 화면에 총 예상액만 보여주면 "왜 이 금액인지" 알 수 없다.
// 어떤 값이 어떻게 곱해졌는지 문장으로 같이 보여준다.
describe("benefitFormula", () => {
  it("월세지원형은 월세와 월 상한 중 작은 값에 개월 수를 곱한 식을 보여준다", () => {
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12 });
    expect(benefitFormula(moland, listing)).toBe(
      "월 환산 월세 350,000원과 월 상한 200,000원 중 작은 값 × 12개월 = 2,400,000원"
    );
  });

  it("월세가 상한보다 낮으면 식에도 실제 월세가 쓰인 것이 보인다", () => {
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 150000, months: 12 });
    expect(benefitFormula(moland, listing)).toContain("150,000원과 월 상한 200,000원");
    expect(benefitFormula(moland, listing)).toContain("= 1,800,000원");
  });

  it("정책의 지원 개월 상한을 넘는 계약이면 상한 개월로 계산한 식을 보여준다", () => {
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 200000, months: 30 });
    expect(benefitFormula(moland, listing)).toContain("× 24개월");
  });

  it("정액형은 실제 월세와 무관한 정액 × 개월 수로 보여준다", () => {
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 900000, months: 12 });
    expect(benefitFormula(jeonbuk, listing)).toBe("월 300,000원 × 12개월 = 3,600,000원");
  });

  it("일시금형은 실제 지출과 상한 중 작은 값으로 보여준다", () => {
    const listing = makeListing({ oneTimeMoveCost: 300000 });
    expect(benefitFormula(iksanMoving, listing)).toBe(
      "실제 일시 지출 300,000원과 상한 500,000원 중 작은 값 = 300,000원"
    );
  });

  it("식의 결과는 실제 계산 금액과 항상 같다", () => {
    const listing = makeListing({ contractType: "연세", rentOrYearlyAmount: 4800000, months: 12 });
    for (const policy of policies) {
      const amount = estimatePolicyAmount(policy, listing).toLocaleString();
      expect(benefitFormula(policy, listing), policy.id).toContain(`= ${amount}원`);
    }
  });
});

describe("payoutTiming", () => {
  it("월 단위 지원은 매월 지급이고 지원 개월 상한을 함께 알려준다", () => {
    expect(payoutTiming(moland)).toBe("매월 지급 · 최대 24개월");
    expect(payoutTiming(jeonbuk)).toBe("매월 지급 · 최대 12개월");
  });

  it("지원 개월 상한이 없는 정책은 거주 기간 동안 매월 지급이다", () => {
    expect(payoutTiming(housingBenefit)).toBe("매월 지급 · 거주 기간 동안");
  });

  it("일시금은 1회 지급이다", () => {
    expect(payoutTiming(iksanMoving)).toBe("1회 지급");
  });
});

// 화면에 benefitType 을 그대로 찍으면 "rent_capped_monthly" 가 사용자에게 보인다.
describe("benefitTypeLabel", () => {
  it("지원 형태를 사람이 읽는 말로 바꾼다", () => {
    expect(benefitTypeLabel("rent_capped_monthly")).toBe("월세 지원 · 실제 월세 범위 내");
    expect(benefitTypeLabel("flat_monthly")).toBe("정액 지원 · 월 고정액");
    expect(benefitTypeLabel("lump_sum")).toBe("일시금 지원 · 실비");
  });

  it("정책 데이터의 모든 benefitType 에 이름이 있다", () => {
    for (const policy of policies) {
      expect(benefitTypeLabel(policy.benefitType), policy.id).not.toContain("_");
    }
  });
});
