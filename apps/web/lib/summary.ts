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

export interface SummaryHighlights {
  /** 최대 지원 가능액을 구성한 정책 */
  included: { id: string; name: string; amount: number }[];
  /** 그 조합에 들어갔지만 아직 확인되지 않은 조건 (F4-8) */
  unknownConditions: { policyId: string; policy: string; label: string }[];
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

  return {
    included: includedResults.map((r) => ({
      id: r.policy.id,
      name: r.policy.name,
      amount: r.estimatedAmount,
    })),
    unknownConditions: includedResults
      .filter((r) => r.status === "조건충족시가능")
      .flatMap((r) =>
        r.unknownLabels.map((label) => ({
          policyId: r.policy.id,
          policy: r.policy.name,
          label,
        }))
      ),
  };
}
