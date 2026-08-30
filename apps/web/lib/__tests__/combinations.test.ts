import { describe, expect, it } from "vitest";
import { bestCombination, excludedByOverlap } from "../combinations";
import type { PolicyMeta, PolicyResult } from "../types";

function makeResult(overrides: Partial<PolicyMeta> & { status: PolicyResult["status"]; amount: number }): PolicyResult {
  const { status, amount, ...policyOverrides } = overrides;
  const policy: PolicyMeta = {
    id: "p",
    discovery: {
      ageMin: 19,
      ageMax: 39,
      regions: ["전국"],
      statuses: null,
      incomeBracketMin: null,
      incomeBracketMax: null,
    },
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
    youthPolicyNo: null,
    gov24ServiceId: null,
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

// F4-5: 중복 제한 때문에 빠진 정책을 화면에 알려줘야 한다. 조용히 빠지면
// 사용자는 "왜 이 정책이 최대 지원 가능액에 없지?" 를 알 수 없다.
describe("excludedByOverlap", () => {
  it("같은 배타 그룹의 더 큰 정책이 뽑히면, 빠진 정책과 충돌 상대를 알려준다", () => {
    const big = makeResult({ id: "big", name: "큰 월세지원", exclusiveGroup: ["rent"], status: "예상적용", amount: 4800000 });
    const small = makeResult({ id: "small", name: "작은 월세지원", exclusiveGroup: ["rent"], status: "예상적용", amount: 2400000 });
    const combination = bestCombination([big, small]);

    const excluded = excludedByOverlap([big, small], combination);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].policy.id).toBe("small");
    expect(excluded[0].conflictsWith).toEqual(["큰 월세지원"]);
  });

  it("배타 그룹이 겹치지 않으면 아무것도 제외되지 않는다", () => {
    const a = makeResult({ id: "a", exclusiveGroup: ["rent"], status: "예상적용", amount: 2400000 });
    const b = makeResult({ id: "b", exclusiveGroup: [], status: "예상적용", amount: 3600000 });
    const combination = bestCombination([a, b]);
    expect(excludedByOverlap([a, b], combination)).toEqual([]);
  });

  it("대상아님·신청불가는 중복 제한과 무관하므로 세지 않는다", () => {
    const included = makeResult({ id: "in", exclusiveGroup: ["rent"], status: "예상적용", amount: 2400000 });
    const rejected = makeResult({ id: "out", exclusiveGroup: ["rent"], status: "대상아님", amount: 0 });
    const combination = bestCombination([included, rejected]);
    expect(excludedByOverlap([included, rejected], combination)).toEqual([]);
  });

  it("금액이 0이라 빠진 정책은 중복 제한으로 빠진 것이 아니다", () => {
    const paid = makeResult({ id: "paid", exclusiveGroup: [], status: "예상적용", amount: 2400000 });
    const zero = makeResult({ id: "zero", exclusiveGroup: [], status: "조건충족시가능", amount: 0 });
    const combination = bestCombination([paid, zero]);
    expect(excludedByOverlap([paid, zero], combination)).toEqual([]);
  });
});
