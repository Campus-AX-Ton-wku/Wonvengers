import type { CheckOutcome, EligibilityProfile, ListingInput, PolicyMeta, PolicyResult, PolicyStatus } from "./types";
import { POLICY_RULES } from "./policy-rules";
import { formatDotDate, isWithinWindow } from "./date";
import { estimatePolicyAmount, supportAgeLimit } from "./benefit";
import { applyConfirmations } from "./confirm";

/**
 * 2층 규칙(lib/policy-rules.ts)이 아직 없는 정책 — Supabase 에만 등록한 새 정책 (2026-11-16 부터).
 * 확인 항목 0개를 '모두 통과'로 읽으면 '예상적용'이라는 거짓말이 된다. 확인할 것이 남았다고 말한다.
 */
const NO_RULES_CHECK: CheckOutcome = {
  key: "noRules",
  label: "세부 자격 조건",
  result: "unknown",
  howToConfirm: "공고 원문의 지원 대상 · 제외 대상을 확인하세요",
};

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

  // 1층의 계약 형태 조건(예: 전세 계약만)을 2층 계약에도 적용한다. 2층 규칙(policy-rules.ts)에는 이 검사가 없어서
  // 월세로 계산한 사람에게 전세 전용 정책이 '조건충족시가능'으로 떴다(11/17). 2층은 11/23 부터 전세도 다룬다.
  const housingTypes = policy.discovery.housingTypes;
  if (housingTypes !== null && !housingTypes.includes(listing.contractType)) {
    return {
      policy,
      status: "대상아님",
      checks: [],
      passedLabels: [],
      failedLabels: [`${housingTypes.join(" · ")} 계약만 신청할 수 있어요`],
      unknownLabels: [],
      estimatedAmount: 0,
    };
  }

  const ruleFn = POLICY_RULES[policy.id];
  const checks = ruleFn ? ruleFn(profile, asOfISO) : [NO_RULES_CHECK];

  // 받는 동안 나이를 따지는 지원인데 계약 시작 때 이미 나이 상한을 넘으면 한 달도 못 받는다 (11/21).
  // 0원 카드로 두면 '계산하지 않는 지원'처럼 읽히므로 실패한 조건으로 남긴다.
  // 계약 형태를 따지지 않는 월세 상한 지원(주거급여 분리지급)을 전세로 계산하면 기준이 될 월세가 없다(11/23).
  // 탈락시키지도, 대출 이자로 금액을 세지도 않는다 — 확인할 것으로 남긴다 (benefit.ts cappedRentBase).
  if (policy.benefitType === "rent_capped_monthly" && listing.contractType === "전세") {
    checks.push({
      key: "jeonseAmount",
      label: "전세 계약의 지급액 — 앱이 계산하지 않아요",
      result: "unknown",
      howToConfirm: "전세 계약에도 주는지, 얼마를 주는지 공고 원문이나 문의처에서 확인하세요.",
    });
  }

  const ageLimit = supportAgeLimit(policy, listing, profile.birthDate);
  if (ageLimit && ageLimit.months === 0) {
    checks.push({
      key: "ageDuringSupport",
      label: `계약 시작일(${formatDotDate(listing.contractStartDate)}) 전에 만 ${ageLimit.ageMax + 1}세가 돼요 — 만 ${ageLimit.ageMax}세까지만 받을 수 있어요`,
      result: "fail",
    });
  }

  // 결과 전 '확인할 것'(11/23)에서 답한 조건 — 아직 모르는 조건에만 입힌다(lib/confirm.ts)
  const judged = applyConfirmations(policy.id, checks, profile.selfDeclared);
  const failed = judged.filter((c) => c.result === "fail");
  const unknown = judged.filter((c) => c.result === "unknown");
  const passed = judged.filter((c) => c.result === "pass");

  let status: PolicyStatus;
  if (failed.length > 0) status = "대상아님";
  else if (unknown.length > 0) status = "조건충족시가능";
  else status = "예상적용";

  const estimatedAmount = status === "대상아님" ? 0 : estimatePolicyAmount(policy, listing, profile.birthDate);

  return {
    policy,
    status,
    checks: judged,
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
