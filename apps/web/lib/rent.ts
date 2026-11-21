import type { ListingInput } from "./types";

/** 연세 한 번이 덮는 개월 수 — 연세 계약은 1년이 일반적이다 (11/21 ggue). */
export const YEARLY_RENT_MONTHS = 12;

/**
 * F1-5: 연세는 1년 치로 보고 연세액 ÷ 12 로 월 환산한다. 관리비는 포함하지 않는다 (F1-6).
 * 11/21 까지는 '÷ 거주 개월 수'였다 — 24개월로 넣으면 1년 치 연세를 24로 나눠 월세가 반으로 줄었다.
 */
export function monthlyRentEquivalent(listing: ListingInput): number {
  if (listing.contractType === "월세") return listing.rentOrYearlyAmount;
  return Math.round(listing.rentOrYearlyAmount / YEARLY_RENT_MONTHS);
}

/**
 * 결과가 세는 개월 수 = 사용자가 입력한 거주 예정 개월 수 그대로 (11/21 ggue — '최대 12개월' 규칙 삭제).
 *
 * 주거비 · 지원금 · 영수증 · 홈이 모두 이 값을 쓴다. 11/21 까지는 주거비 쪽만 12개월로 잘랐고
 * 지원 개월 수(benefit.ts)는 안 잘라서, 24개월로 넣은 사람에게 지원(24개월)이 주거비(12개월)보다 크게 나왔다.
 * 기간을 다시 바꿀 때는 여기 한 곳만 바꾼다 — 쪽마다 따로 세면 또 어긋난다.
 */
export function calcMonths(listing: ListingInput): number {
  return listing.months;
}

/** 계산 기간 명목 총 지출 = (월 환산 임대료 + 월 관리비) × 개월 수 + 일시 지출 */
export function nominalTotalCost(listing: ListingInput): number {
  const months = calcMonths(listing);
  return (monthlyRentEquivalent(listing) + listing.managementFee) * months + listing.oneTimeMoveCost;
}
