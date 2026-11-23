import type { CalculationSummary, EligibilityProfile, ListingInput, PolicyMeta } from "./types";
import type { PolicyResult } from "./types";
import { evaluateAllPolicies } from "./eligibility";
import { bestCombination } from "./combinations";
import { selfConfirmedConditions } from "./confirm";
import { nominalTotalCost } from "./rent";

export function buildCalculationSummary(
  policies: PolicyMeta[],
  profile: EligibilityProfile,
  listing: ListingInput,
  asOfISO: string
): CalculationSummary {
  const results = evaluateAllPolicies(policies, profile, listing, asOfISO);
  const combination = bestCombination(results);
  const nominal = nominalTotalCost(listing);

  return {
    nominalTotalCost: nominal,
    maxSupportAmount: combination.totalAmount,
    finalEstimatedHousingCost: Math.max(0, nominal - combination.totalAmount),
    bestCombination: combination,
    results,
  };
}

export interface PendingSupport {
  /** 맨 위 합계 중 아직 확인하지 않은 조건이 걸린 몫 */
  amount: number;
  /** 그 몫을 이루는 '조건 충족 시 가능' 지원 */
  policyIds: string[];
}

/**
 * 맨 위 합계 중 추가로 조건을 확인해야 하는 몫 (11/23 ggue). 합계에는 넣는다(lib/combinations.ts) —
 * 대신 결과 화면이 그 몫과 조건을 밝히고, 결과 전 '확인할 것'(lib/confirm.ts)에서 반드시 답하게 한다.
 * 그래서 보통은 0 이다. 0 이 아니면 '확인할 것'을 거치지 않고 들어온 경우다(결과 화면이 그리로 보낸다).
 */
export function pendingSupport(summary: CalculationSummary): PendingSupport {
  const included = new Set(summary.bestCombination.includedPolicyIds);
  const pending = summary.results.filter((r) => r.status === "조건충족시가능" && r.estimatedAmount > 0 && included.has(r.policy.id));
  return { amount: pending.reduce((sum, r) => sum + r.estimatedAmount, 0), policyIds: pending.map((r) => r.policy.id) };
}

export interface SummaryHighlights {
  /** 맨 위 합계를 구성한 정책 */
  included: { id: string; name: string; amount: number }[];
  /** 합계 중 아직 확인하지 않은 조건이 걸린 몫과 그 조건 (F4-8 · 11/23) */
  pending: { amount: number; conditions: { policyId: string; policy: string; label: string }[] };
  /** 합계에 든 지원 중 '확인할 것'에서 직접 답해 정해진 조건 — 신청할 때 기관이 다시 확인한다 (11/23) */
  selfConfirmed: { policyId: string; policy: string; label: string }[];
}

/**
 * 결과 상단(F4-4)이 쓰는 파생값.
 *
 * 두 화면이 각자 계산하면 캡처한 요약과 상세 화면의 숫자가 어긋난다.
 */
export function summaryHighlights(summary: CalculationSummary): SummaryHighlights {
  const isIncluded = (r: PolicyResult) =>
    summary.bestCombination.includedPolicyIds.includes(r.policy.id);
  const includedResults = summary.results.filter(isIncluded);
  const pending = pendingSupport(summary);

  return {
    included: includedResults.map((r) => ({
      id: r.policy.id,
      name: r.policy.name,
      amount: r.estimatedAmount,
    })),
    selfConfirmed: selfConfirmedConditions(summary),
    pending: {
      amount: pending.amount,
      conditions: summary.results
        .filter((r) => pending.policyIds.includes(r.policy.id))
        .flatMap((r) => r.unknownLabels.map((label) => ({ policyId: r.policy.id, policy: r.policy.name, label }))),
    },
  };
}
