import type { ListingInput, PolicyMeta } from "./types";
import { monthlyRentEquivalent } from "./rent";

/** 정책 하나를 단독으로 받는다고 가정했을 때의 총 예상액. */
export function estimatePolicyAmount(policy: PolicyMeta, listing: ListingInput): number {
  const eligibleMonths = Math.min(policy.maxMonths ?? listing.months, listing.months);

  if (policy.benefitType === "rent_capped_monthly") {
    const monthly = Math.min(policy.monthlyCap ?? Infinity, monthlyRentEquivalent(listing));
    return Math.max(0, Math.round(monthly * eligibleMonths));
  }

  if (policy.benefitType === "flat_monthly") {
    return Math.max(0, Math.round((policy.monthlyCap ?? 0) * eligibleMonths));
  }

  // lump_sum
  return Math.min(policy.lumpSumCap ?? Infinity, listing.oneTimeMoveCost);
}
