import type { CalculationSummary, EligibilityProfile, ListingInput, PolicyMeta } from "./types";
import type { PolicyResult } from "./types";
import { evaluateAllPolicies } from "./eligibility";
import { bestCombination } from "./combinations";
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
  /** 조건을 확인하면 맨 위 합계에 더해질 수 있는 금액(최대). 확인이 끝난 합계와의 차이 */
  amount: number;
  /** 그 몫을 이루는 '조건 충족 시 가능' 지원 */
  policyIds: string[];
}

/**
 * 조건을 확인하면 더 받을 수 있는 몫 (11/23 ggue). 맨 위 합계는 '예상 적용'만 더하므로(lib/combinations.ts),
 * '조건 충족 시 가능'까지 넣은 최선 조합과의 차이를 따로 보여 준다 — 합계에 섞지 않는다.
 */
export function pendingSupport(summary: CalculationSummary): PendingSupport {
  const potential = bestCombination(summary.results, ["예상적용", "조건충족시가능"]);
  const amount = Math.max(0, potential.totalAmount - summary.maxSupportAmount);
  const policyIds =
    amount > 0
      ? summary.results
          .filter((r) => r.status === "조건충족시가능" && r.estimatedAmount > 0 && potential.includedPolicyIds.includes(r.policy.id))
          .map((r) => r.policy.id)
      : [];
  return { amount, policyIds };
}

export interface SummaryHighlights {
  /** 맨 위 합계(확인이 끝난 지원)를 구성한 정책 */
  included: { id: string; name: string; amount: number }[];
  /** 조건을 확인하면 더 받을 수 있는 몫과, 그 몫에 남은 확인할 조건 (F4-8 · 11/23) */
  pending: { amount: number; conditions: { policyId: string; policy: string; label: string }[] };
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
    pending: {
      amount: pending.amount,
      conditions: summary.results
        .filter((r) => pending.policyIds.includes(r.policy.id))
        .flatMap((r) => r.unknownLabels.map((label) => ({ policyId: r.policy.id, policy: r.policy.name, label }))),
    },
  };
}
