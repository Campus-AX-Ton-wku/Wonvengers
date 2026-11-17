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
      contact: null,
      nextRound: null,
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

  it("결과 카드는 확인 방법을 길게 붙이지 않고 조건명만 요약한다", () => {
    const result = makePolicyResult({
      status: "조건충족시가능",
      checks: [
        { key: "first", label: "첫 번째 조건", result: "unknown", howToConfirm: "첫 번째 서류를 확인하세요." },
        { key: "second", label: "두 번째 조건", result: "unknown", howToConfirm: "두 번째 서류를 확인하세요." },
        { key: "third", label: "세 번째 조건", result: "unknown", howToConfirm: "세 번째 서류를 확인하세요." },
      ],
      unknownLabels: [
        "첫 번째 조건 (확인 방법: 첫 번째 서류를 확인하세요.)",
        "두 번째 조건 (확인 방법: 두 번째 서류를 확인하세요.)",
        "세 번째 조건 (확인 방법: 세 번째 서류를 확인하세요.)",
      ],
    });

    const card = toBenefitResultCardData(result, "2026-09-02");
    expect(card?.evidence.message).toBe("첫 번째 조건 · 두 번째 조건 외 1개");
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
    // '신청 준비 시작하기'는 이름 그대로 신청 준비 화면으로 간다(11/17 — 예전엔 상세로 가서 아래 행과 목적지가 갈렸다)
    expect(card.primaryAction.href).toBe("/find/policies/test-policy/prepare");
  });

  describe("금액이 위 합계에 들어가는지 (11/17 결과 화면 정리)", () => {
    it("예상액이 있고 최선 조합에 든 정책만 합계 금액이다", () => {
      const result = makePolicyResult({ estimatedAmount: 120000 });
      const card = toBenefitResultCardData(result, "2026-09-02", new Set(["test-policy"]))!;
      expect(card.amount.countsInTotal).toBe(true);
      expect(card.amount.note).toBeNull();
    });

    it("조합 정보를 안 넘기면 예상액이 있는지로 본다", () => {
      expect(toBenefitResultCardData(makePolicyResult({ estimatedAmount: 120000 }), "2026-09-02")!.amount.countsInTotal).toBe(true);
    });

    it("예상액이 있어도 중복 수급으로 조합에서 빠졌으면 합계 금액이 아니다", () => {
      const card = toBenefitResultCardData(makePolicyResult({ estimatedAmount: 120000 }), "2026-09-02", new Set(["other"]))!;
      expect(card.amount.countsInTotal).toBe(false);
      expect(card.amount.note).toBe("같이 받을 수 없는 지원과 겹쳐 위 합계에서 뺐어요");
    });

    it("공고가 정한 정액(fixedGrant)은 공고 금액을 보여 주되 합계 금액이 아니라고 밝힌다", () => {
      const result = makePolicyResult({ status: "조건충족시가능", unknownLabels: ["전입 이력"], estimatedAmount: 0 });
      result.policy = {
        ...result.policy,
        benefitType: "lump_sum",
        lumpSumBasis: "fixedGrant",
        lumpSumCap: 100000,
        monthlyCap: undefined,
        maxMonths: undefined,
        payoutNote: "전입 6개월 후 1회 지급 · 익산 지역화폐",
      };
      const card = toBenefitResultCardData(result, "2026-09-02", new Set())!;
      expect(card.amount.countsInTotal).toBe(false);
      expect(card.amount.value).toBe(100000);
      expect(card.amount.note).toBe("정해진 금액이라 위 합계에는 넣지 않았어요");
      // '개인 예상액 계산 전'처럼 나중에 계산될 것 같은 말을 쓰지 않는다 — 지급 방식만 적는다
      expect(card.amount.period).toBe("전입 6개월 후 1회 지급 · 익산 지역화폐");
    });
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
