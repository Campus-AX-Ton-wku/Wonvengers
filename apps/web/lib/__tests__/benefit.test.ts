import { describe, expect, it } from "vitest";
import policiesData from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import {
  monthlyBreakdown,
  benefitCeiling,
  largestTotalCeiling,
  benefitFormula,
  benefitTypeLabel,
  estimatePolicyAmount,
  monthsBeforeAgeLimit,
  payoutTiming,
  supportAgeLimit,
  AGE_CHECKED_AT_APPLICATION,
} from "@/lib/benefit";
import { nominalTotalCost } from "@/lib/rent";
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

  it("이사비가 0 이면 '0원과 상한 중 작은 값 = 0원' 대신 계산하지 않는다고 말한다 (11/21 이사비 칸 삭제)", () => {
    const listing = makeListing({ oneTimeMoveCost: 0 });
    const 이사비지원 = policies.filter((p) => p.lumpSumBasis === "oneTimeMoveCost");
    expect(이사비지원.length).toBeGreaterThan(0);
    for (const policy of 이사비지원) {
      expect(estimatePolicyAmount(policy, listing)).toBe(0);
      expect(benefitFormula(policy, listing), policy.id).toContain("계산하지 않습니다");
    }
  });

  it("식의 결과는 실제 계산 금액과 항상 같다", () => {
    // 이사비는 화면이 더는 받지 않지만, 값이 들어오면 식과 금액이 맞는지는 계속 본다
    const listing = makeListing({ contractType: "연세", rentOrYearlyAmount: 4800000, months: 12, oneTimeMoveCost: 300000 });
    // 계약 화면이 그 지출을 받지 않는 정책은 예상액을 내지 않는다. 식 대신 왜
    // 계산하지 않는지를 말한다 (types.ts 의 lumpSumBasis).
    const 계산하는것 = policies.filter(
      (p) => p.benefitType !== "lump_sum" || p.lumpSumBasis === "oneTimeMoveCost"
    );
    expect(계산하는것.length).toBeGreaterThan(0);
    for (const policy of 계산하는것) {
      const amount = estimatePolicyAmount(policy, listing).toLocaleString();
      expect(benefitFormula(policy, listing), policy.id).toContain(`= ${amount}원`);
    }
  });

  /*
   * 보증금반환보증 보증료 지원처럼 2층이 그 지출을 입력받지 않는 lump_sum 은
   * 예상액이 0 이어야 한다. 이걸 빠뜨리면 이사비 30만원을 넣은 사람에게 보증료
   * 30만원이 붙어 최대 지원 가능액이 부풀려진다.
   */
  it("계산 근거가 없는 일시금은 예상액을 0 으로 둔다", () => {
    const listing = makeListing({ oneTimeMoveCost: 300000 });
    const 계산불가 = policies.filter((p) => p.lumpSumBasis === "notCalculable");
    expect(계산불가.length).toBeGreaterThan(0);
    for (const policy of 계산불가) {
      expect(estimatePolicyAmount(policy, listing), policy.id).toBe(0);
      expect(benefitFormula(policy, listing), policy.id).toMatch(/계산하지 않습니다/);
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

/**
 * 1층은 계약 조건을 모르므로 개인별 예상액을 계산할 수 없다 (그건 2층의 일이다).
 * 대신 공고에 적힌 상한을 보여준다 — "이 정책이 최대 얼마짜리인가"는 목록에서
 * 정책을 고르는 데 필요한 정보다. 개인 예상액으로 읽히지 않게 라벨을 붙인다.
 */
describe("benefitCeiling", () => {
  it("월 상한과 지원 개월 수가 있으면 총액 상한을 낸다", () => {
    expect(benefitCeiling(moland)).toEqual({ label: "최대 480만원", amount: 4800000 });
  });

  it("정액형도 월 상한 × 개월 수로 총액을 낸다", () => {
    expect(benefitCeiling(jeonbuk)).toEqual({ label: "최대 360만원", amount: 3600000 });
  });

  it("일시금형은 1회 상한을 낸다", () => {
    expect(benefitCeiling(iksanMoving)).toEqual({ label: "최대 50만원", amount: 500000 });
  });

  it("지원 개월 수가 정해지지 않은 정책은 월 상한만 낸다", () => {
    // 주거급여 분리지급은 거주 기간 동안 계속 받으므로 총액 상한이 없다
    expect(benefitCeiling(housingBenefit)).toEqual({
      label: "월 최대 21만 2,000원",
      amount: 212000,
    });
  });

  it("모든 정책이 상한을 낼 수 있다", () => {
    for (const policy of policies) {
      const ceiling = benefitCeiling(policy);
      expect(ceiling, policy.id).not.toBeNull();
      expect(ceiling!.amount, policy.id).toBeGreaterThan(0);
      expect(ceiling!.label, policy.id).toMatch(/만원|원$/);
    }
  });
});

/**
 * 목록 화면 헤드라인이 쓰는 '가장 큰 한 건'.
 *
 * 합산하지 않는다 — 중복 수급 제한(exclusiveGroup) 때문에 상한을 더하면 거짓이 된다.
 * 정확한 조합은 계약 조건이 있어야 bestCombination 이 계산할 수 있으므로 1층에서는
 * 불가능하다.
 */
describe("largestTotalCeiling", () => {
  const 실제정책 = policiesData as PolicyMeta[];

  it("총액 상한이 가장 큰 정책을 고른다", () => {
    // 국토부 청년월세 월 20만원 × 24개월 = 480만원이 가장 크다 (목표 지역 익산시 기준, 2026-11-15)
    expect(largestTotalCeiling(실제정책)?.label).toBe("최대 480만원");
  });

  it("합산하지 않는다 — 어떤 한 정책의 상한과 같아야 한다", () => {
    const 최대 = largestTotalCeiling(실제정책);
    const 개별상한 = 실제정책.map((p) => benefitCeiling(p)?.amount).filter((a) => a !== undefined);

    expect(개별상한).toContain(최대?.amount);
    expect(최대!.amount).toBeLessThan(개별상한.reduce((s, a) => s + a!, 0));
  });

  /*
   * 주거급여 분리지급은 지원 개월 수가 정해져 있지 않아 총액 상한이 없다.
   * '월 21만원'과 '총 480만원'은 서로 비교할 수 있는 값이 아니므로 후보에서 뺀다.
   */
  it("총액이 정해지지 않은 정책은 후보로 삼지 않는다", () => {
    // 주거급여 분리지급 — 월 상한만 있고 지원 개월 수가 정해져 있지 않다
    const 월상한만 = 실제정책.filter(
      (p) => p.benefitType !== "lump_sum" && p.monthlyCap != null && p.maxMonths == null
    );

    expect(월상한만.length).toBeGreaterThan(0);
    expect(largestTotalCeiling(월상한만)).toBeNull();
  });

  it("고를 정책이 없으면 없다고 한다", () => {
    expect(largestTotalCeiling([])).toBeNull();
  });
});

describe("monthlyBreakdown — 매달 주는 지원의 한 달 금액 (11/18 결과 카드 단위)", () => {
  const all = policiesData as PolicyMeta[];
  const split = all.find((p) => p.id === "youth-housing-benefit-split-payment")!;

  it("월세 상한형은 월세와 상한 중 작은 값 × 개월", () => {
    // 연세 480만원 → 월 40만원, 상한 21만 2천원
    expect(monthlyBreakdown(split, makeListing())).toEqual({ monthly: 212000, months: 12 });
  });

  it("일시금은 매달 주는 지원이 아니다", () => {
    const lump = all.find((p) => p.benefitType === "lump_sum")!;
    expect(monthlyBreakdown(lump, makeListing())).toBeNull();
  });
});

/*
 * 11/21 (ggue 실기기): 거주 24개월로 넣었더니 주거비는 12개월(월세·관리비 480만원)로, 청년 주거급여
 * 분리지급은 24개월(21만 2천원 × 24 = 508만 8천원)로 세어 지원이 주거비보다 커졌다. 처음엔 둘 다 12개월로
 * 맞췄는데, ggue 결정으로 '최대 12개월' 규칙을 없애고 둘 다 입력한 개월 수 그대로 센다.
 */
describe("계산 기간 — 주거비와 지원금은 입력한 개월 수로 같이 센다", () => {
  const listing24 = makeListing({ contractType: "월세", rentOrYearlyAmount: 300000, managementFee: 100000, months: 24 });

  it("지급 기간 상한이 없는 지원(청년 주거급여)은 입력한 24개월을 센다", () => {
    expect(estimatePolicyAmount(housingBenefit, listing24)).toBe(212000 * 24);
    expect(monthlyBreakdown(housingBenefit, listing24)).toEqual({ monthly: 212000, months: 24 });
    expect(benefitFormula(housingBenefit, listing24)).toContain("× 24개월");
  });

  it("주거비도 같은 24개월로 세어, 월 지원이 월세보다 작으면 지원이 주거비를 넘지 않는다", () => {
    expect(nominalTotalCost(listing24)).toBe((300000 + 100000) * 24);
    expect(estimatePolicyAmount(housingBenefit, listing24)).toBeLessThanOrEqual(nominalTotalCost(listing24));
  });

  it("정책의 지급 기간 상한(국토부 청년월세 24개월)은 그대로 지킨다", () => {
    const listing36 = makeListing({ contractType: "월세", rentOrYearlyAmount: 300000, months: 36 });
    expect(estimatePolicyAmount(moland, listing36)).toBe(200000 * 24);
  });

  it("12개월보다 짧게 살면 그 개월 수로 센다", () => {
    const listing6 = makeListing({ contractType: "월세", rentOrYearlyAmount: 300000, months: 6 });
    expect(estimatePolicyAmount(housingBenefit, listing6)).toBe(212000 * 6);
  });
});

/*
 * 11/21 (ggue): 입력한 거주 개월 수를 그대로 세면서 나이 상한을 넘는 기간까지 지원이 붙는 문제.
 * 정책별로 나눈다 — 나이를 '신청할 때 한 번' 보는 지원은 자르지 않고, '받는 동안 계속' 보는 지원
 * (그리고 구분이 안 된 지원)은 만 (상한+1)세 생일 전까지 다 채운 달만 센다.
 */
describe("나이 상한 — 받는 동안 나이를 따지는 지원은 상한을 넘기 전 달까지만 센다", () => {
  const 시작 = "2026-12-01";
  const listing36 = makeListing({ contractType: "월세", rentOrYearlyAmount: 300000, months: 36, contractStartDate: 시작 });
  const listing24 = makeListing({ contractType: "월세", rentOrYearlyAmount: 300000, months: 24, contractStartDate: 시작 });

  it("계약 시작부터 만 (상한+1)세 생일 전까지 다 채운 달 수를 센다", () => {
    expect(monthsBeforeAgeLimit("1998-05-10", 29, "2026-12-01")).toBe(17); // 2028-05-10 에 만 30세
    expect(monthsBeforeAgeLimit("1998-05-10", 29, "2026-12-15")).toBe(16); // 2028-04-15 ~ 05-15 는 다 못 채운다
    expect(monthsBeforeAgeLimit("1998-05-10", 29, "2028-06-01")).toBe(0); // 시작 때 이미 넘었다
  });

  it("청년 주거급여 분리지급(만 30세 미만)은 36개월로 넣어도 만 30세 생일 전까지만 센다", () => {
    expect(estimatePolicyAmount(housingBenefit, listing36, "1998-05-10")).toBe(212000 * 17);
    expect(monthlyBreakdown(housingBenefit, listing36, "1998-05-10")).toEqual({ monthly: 212000, months: 17 });
    expect(supportAgeLimit(housingBenefit, listing36, "1998-05-10")).toEqual({ months: 17, ageMax: 29, endDate: "2028-05-10" });
    expect(benefitFormula(housingBenefit, listing36, "1998-05-10")).toContain("× 17개월");
    expect(benefitFormula(housingBenefit, listing36, "1998-05-10")).toContain("만 30세가 되는 2028.05.10 전까지");
  });

  it("상한에 닿지 않으면 입력한 개월 수 그대로다", () => {
    expect(estimatePolicyAmount(housingBenefit, listing24, "2003-08-12")).toBe(212000 * 24);
    expect(supportAgeLimit(housingBenefit, listing24, "2003-08-12")).toBeNull();
  });

  it("신청할 때 한 번만 나이를 보는 지원(국토부 청년월세 · 공고 '1991~2007년생')은 자르지 않는다", () => {
    expect(AGE_CHECKED_AT_APPLICATION.has(moland.id)).toBe(true);
    // 2027-01-15 에 만 35세가 되지만 신청 때 34세였으면 24개월 다 받는다
    expect(estimatePolicyAmount(moland, listing24, "1992-01-15")).toBe(200000 * 24);
    expect(supportAgeLimit(moland, listing24, "1992-01-15")).toBeNull();
  });

  it("구분이 안 된 새 정책은 받는 동안 나이를 따진다고 보고 자른다 — 금액을 부풀리지 않게", () => {
    const 새정책 = { ...moland, id: "some-new-policy" };
    expect(estimatePolicyAmount(새정책, listing24, "1992-01-15")).toBe(200000 * 1);
  });

  it("생년월일을 모르면 자르지 않는다", () => {
    expect(estimatePolicyAmount(housingBenefit, listing36)).toBe(212000 * 36);
  });
});
