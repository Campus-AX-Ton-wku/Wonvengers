import type { CalculationSummary, EligibilityProfile, ListingInput, PolicyMeta } from "./types";
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
