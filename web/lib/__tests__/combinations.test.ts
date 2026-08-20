import { describe, expect, it } from "vitest";
import { bestCombination } from "../combinations";
import type { PolicyMeta, PolicyResult } from "../types";

function makeResult(overrides: Partial<PolicyMeta> & { status: PolicyResult["status"]; amount: number }): PolicyResult {
  const { status, amount, ...policyOverrides } = overrides;
  const policy: PolicyMeta = {
    id: "p",
    discovery: { ageMin: 19, ageMax: 39, regions: ["전국"], statuses: null, incomeBracketMax: null },
    name: "p",
    agency: "",
    regionScope: "",
    applicationStart: "2026-01-01",
    applicationEnd: null,
    benefitType: "flat_monthly",
    benefitSummary: "",
    requiredInputs: [],
    exclusiveGroup: [],
    sourceUrl: "",
    applyUrl: "",
    verifiedAt: null,
    effectiveYear: 2026,
    notes: "",
    ...policyOverrides,
  };
  return {
    policy,
    status,
    checks: [],
    passedLabels: [],
    failedLabels: [],
    unknownLabels: [],
    estimatedAmount: amount,
  };
}

describe("bestCombination", () => {
  it("같은 배타 그룹에 속한 두 정책을 동시에 합산하지 않는다", () => {
    const a = makeResult({ id: "a", exclusiveGroup: ["rent"], status: "예상적용", amount: 2400000 });
    const b = makeResult({ id: "b", exclusiveGroup: ["rent"], status: "예상적용", amount: 4800000 });
    const result = bestCombination([a, b]);

    expect(result.includedPolicyIds).toEqual(["b"]);
    expect(result.totalAmount).toBe(4800000);
  });

  it("배타 그룹이 다르면 함께 합산한다", () => {
    const a = makeResult({ id: "a", exclusiveGroup: ["rent"], status: "예상적용", amount: 2400000 });
    const c = makeResult({ id: "c", exclusiveGroup: [], status: "예상적용", amount: 3600000 });
    const result = bestCombination([a, c]);

    expect(new Set(result.includedPolicyIds)).toEqual(new Set(["a", "c"]));
    expect(result.totalAmount).toBe(6000000);
  });

  it("대상아님·신청불가 정책은 조합 후보에서 제외한다", () => {
    const a = makeResult({ id: "a", status: "대상아님", amount: 0 });
    const b = makeResult({ id: "b", status: "신청불가", amount: 0 });
    const c = makeResult({ id: "c", status: "조건충족시가능", amount: 1000000 });
    const result = bestCombination([a, b, c]);

    expect(result.includedPolicyIds).toEqual(["c"]);
  });

  it("후보가 없으면 0원, 빈 조합을 반환한다", () => {
    const result = bestCombination([]);
    expect(result.totalAmount).toBe(0);
    expect(result.includedPolicyIds).toEqual([]);
  });
});
