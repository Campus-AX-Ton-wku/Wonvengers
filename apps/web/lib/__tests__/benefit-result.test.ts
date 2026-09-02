import { describe, expect, it } from "vitest";
import { benefitResultCards, benefitResultState, daysUntil, isExpiredResult, resultAvailability, toBenefitResultCardData } from "@/lib/benefit-result";
import type { CalculationSummary, PolicyResult } from "@/lib/types";

function makePolicyResult(overrides: Partial<PolicyResult> = {}): PolicyResult {
  return {
    policy: {
      id: "test-policy",
      discovery: { ageMin: 19, ageMax: 34, regions: ["전국"], statuses: null, incomeBracketMin: null, incomeBracketMax: null, housingTypes: null },
      name: "실제 테스트 정책",
      agency: "테스트 기관",
      regionScope: "전국",
      applicationStart: "2026-01-01",
      applicationEnd: "2026-12-31",
      benefitType: "flat_monthly",
      benefitSummary: "실제 값으로 계산",
      monthlyCap: 100000,
      maxMonths: 12,
      requiredInputs: [],
      exclusiveGroup: [],
      sourceUrl: "https://example.com/source",
      applyUrl: "https://example.com/apply",
      youthPolicyNo: null,
      gov24ServiceId: null,
      verifiedAt: "2026-08-30",
      effectiveYear: 2026,
      notes: "",
    },
    status: "예상적용",
    checks: [],
    passedLabels: ["나이"],
    failedLabels: [],
    unknownLabels: [],
    estimatedAmount: 100000,
    ...overrides,
  };
}

describe("Benefit Result Card adapter", () => {
  it("미확인 요건은 마감 임박보다 check가 우선이다", () => {
    const result = makePolicyResult({ status: "조건충족시가능", unknownLabels: ["소득 확인"] });
    result.policy.applicationEnd = "2026-09-07";
    expect(benefitResultState(result, "2026-09-02")).toBe("check");
  });

  it("확인 완료된 신청 가능 정책이 KST 달력 기준 0~7일 남으면 urgent다", () => {
    const result = makePolicyResult({ status: "예상적용", unknownLabels: [] });
    result.policy.applicationEnd = "2026-09-09";
    expect(benefitResultState(result, "2026-09-02")).toBe("urgent");
  });

  it("카드 금액과 날짜는 실제 정책·판정 데이터에서 온다", () => {
    const result = makePolicyResult({ status: "예상적용", estimatedAmount: 123456 });
    result.policy.applicationEnd = "2026-10-31";
    const card = toBenefitResultCardData(result, "2026-09-02");
    if (!card) throw new Error("카드 후보가 누락됨");
    expect(card.amount.value).toBe(123456);
    expect(card.deadlineAt).toBe("2026-10-31");
    expect(card.primaryAction.href).toBe("/find/policies/test-policy");
    expect(card.steps[2].href).toBe(`/find/policies/${result.policy.id}/prepare`);
  });

  it("지난 마감일은 expired 상태 화면의 근거가 된다", () => {
    const result = makePolicyResult();
    result.policy.applicationEnd = "2026-09-01";
    expect(isExpiredResult(result, "2026-09-02")).toBe(true);
  });

  it("대상아님과 신청불가는 공식 카드 세 variant에서 제외한다", () => {
    expect(benefitResultState(makePolicyResult({ status: "대상아님" }), "2026-09-02")).toBeNull();
    expect(benefitResultState(makePolicyResult({ status: "신청불가" }), "2026-09-02")).toBeNull();
  });

  it("KST 달력 날짜 기준으로 오늘과 7일 경계를 포함한다", () => {
    expect(daysUntil("2026-09-02", "2026-09-02")).toBe(0);
    expect(daysUntil("2026-09-02", "2026-09-09")).toBe(7);
    expect(daysUntil("2026-09-02", "2026-09-10")).toBe(8);
  });

  it("urgent, eligible, check 순으로 실제 후보만 반환한다", () => {
    const urgent = makePolicyResult();
    urgent.policy = { ...urgent.policy, id: "urgent", applicationEnd: "2026-09-03" };
    const eligible = makePolicyResult();
    eligible.policy = { ...eligible.policy, id: "eligible", applicationEnd: null };
    const check = makePolicyResult({ status: "조건충족시가능", unknownLabels: ["소득"] });
    check.policy = { ...check.policy, id: "check", applicationEnd: null };
    const excluded = makePolicyResult({ status: "대상아님" });
    excluded.policy = { ...excluded.policy, id: "excluded" };
    expect(benefitResultCards([check, excluded, eligible, urgent], "2026-09-02").map((card) => card.state)).toEqual(["urgent", "eligible", "check"]);
  });

  it("후보가 없고 모든 지역 정책 접수가 끝났을 때 expired다", () => {
    const closed = makePolicyResult({ status: "신청불가", estimatedAmount: 0 });
    closed.policy.applicationEnd = "2026-09-01";
    const summary: CalculationSummary = {
      nominalTotalCost: 0,
      maxSupportAmount: 0,
      finalEstimatedHousingCost: 0,
      bestCombination: { includedPolicyIds: [], totalAmount: 0 },
      results: [closed],
    };
    expect(resultAvailability(summary, "2026-09-02")).toBe("expired");
  });
});
