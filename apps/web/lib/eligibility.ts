import type { EligibilityProfile, ListingInput, PolicyMeta, PolicyResult, PolicyStatus } from "./types";
import { POLICY_RULES } from "./policy-rules";
import { isWithinWindow } from "./date";
import { estimatePolicyAmount } from "./benefit";

/** 정책 하나를 판정한다. 판정과 금액 계산은 모두 결정론적 규칙으로만 수행한다 (F3-1, F3-2). */
export function evaluatePolicy(
  policy: PolicyMeta,
  profile: EligibilityProfile,
  listing: ListingInput,
  asOfISO: string
): PolicyResult {
  const window = isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd);

  if (window !== "within") {
    return {
      policy,
      status: "신청불가",
      checks: [],
      passedLabels: [],
      failedLabels: [
        window === "before" ? "아직 신청 시작 전입니다." : "신청 기간이 마감되었습니다.",
      ],
      unknownLabels: [],
      estimatedAmount: 0,
    };
  }

  const ruleFn = POLICY_RULES[policy.id];
  const checks = ruleFn ? ruleFn(profile, asOfISO) : [];

  const failed = checks.filter((c) => c.result === "fail");
  const unknown = checks.filter((c) => c.result === "unknown");
  const passed = checks.filter((c) => c.result === "pass");

  let status: PolicyStatus;
  if (failed.length > 0) status = "대상아님";
  else if (unknown.length > 0) status = "조건충족시가능";
  else status = "예상적용";

  const estimatedAmount = status === "대상아님" ? 0 : estimatePolicyAmount(policy, listing);

  return {
    policy,
    status,
    checks,
    passedLabels: passed.map((c) => c.label),
    failedLabels: failed.map((c) => c.label),
    unknownLabels: unknown.map((c) => c.howToConfirm ? `${c.label} (확인 방법: ${c.howToConfirm})` : c.label),
    estimatedAmount,
  };
}

export function evaluateAllPolicies(
  policies: PolicyMeta[],
  profile: EligibilityProfile,
  listing: ListingInput,
  asOfISO: string
): PolicyResult[] {
  return policies.map((policy) => evaluatePolicy(policy, profile, listing, asOfISO));
}
