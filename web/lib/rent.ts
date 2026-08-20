import type { ListingInput } from "./types";

/** F1-6: 연세는 연세액 ÷ 계약 개월 수로 월 환산한다. 관리비는 포함하지 않는다 (F1-7). */
export function monthlyRentEquivalent(listing: ListingInput): number {
  if (listing.contractType === "월세") return listing.rentOrYearlyAmount;
  return Math.round(listing.rentOrYearlyAmount / listing.months);
}

/** 계산 기간(최대 12개월) 명목 총 지출 = (월 환산 임대료 + 월 관리비) × 개월 수 + 일시 지출 */
export function nominalTotalCost(listing: ListingInput): number {
  const months = Math.min(listing.months, 12);
  return (monthlyRentEquivalent(listing) + listing.managementFee) * months + listing.oneTimeMoveCost;
}
