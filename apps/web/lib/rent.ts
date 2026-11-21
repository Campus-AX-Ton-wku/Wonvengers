import type { ListingInput } from "./types";

/** F1-6: 연세는 연세액 ÷ 계약 개월 수로 월 환산한다. 관리비는 포함하지 않는다 (F1-7). */
export function monthlyRentEquivalent(listing: ListingInput): number {
  if (listing.contractType === "월세") return listing.rentOrYearlyAmount;
  return Math.round(listing.rentOrYearlyAmount / listing.months);
}

/** 결과가 세는 기간의 상한 (PRD F3-C '기본 결과는 최대 12개월 기준'). */
export const MAX_CALC_MONTHS = 12;

/**
 * 결과가 세는 개월 수 = 거주 예정 개월 수와 12개월 중 작은 값.
 *
 * 주거비 · 지원금 · 영수증 · 홈이 모두 이 값을 쓴다. 11/21 까지는 주거비 쪽만 12개월로 잘랐고
 * 지원 개월 수(benefit.ts)는 안 잘라서, 24개월로 넣은 사람에게 지원(24개월)이 주거비(12개월)보다 크게 나왔다.
 */
export function calcMonths(listing: ListingInput): number {
  return Math.min(listing.months, MAX_CALC_MONTHS);
}

/** 계산 기간(최대 12개월) 명목 총 지출 = (월 환산 임대료 + 월 관리비) × 개월 수 + 일시 지출 */
export function nominalTotalCost(listing: ListingInput): number {
  const months = calcMonths(listing);
  return (monthlyRentEquivalent(listing) + listing.managementFee) * months + listing.oneTimeMoveCost;
}
