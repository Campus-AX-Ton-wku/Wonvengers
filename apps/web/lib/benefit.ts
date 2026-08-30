import type { BenefitType, ListingInput, PolicyMeta } from "./types";
import { monthlyRentEquivalent } from "./rent";
import { formatKoreanMoney } from "./money";

const won = (amount: number) => `${amount.toLocaleString()}원`;

const BENEFIT_TYPE_LABEL: Record<BenefitType, string> = {
  rent_capped_monthly: "월세 지원 · 실제 월세 범위 내",
  flat_monthly: "정액 지원 · 월 고정액",
  lump_sum: "일시금 지원 · 실비",
};

/** 지원 형태를 사람이 읽는 말로. 화면에 benefitType 을 그대로 찍으면 영문 코드가 노출된다. */
export function benefitTypeLabel(type: BenefitType): string {
  return BENEFIT_TYPE_LABEL[type];
}

/** 정책의 지원 개월 상한과 실제 거주 개월 중 작은 값. */
function supportedMonths(policy: PolicyMeta, listing: ListingInput): number {
  return Math.min(policy.maxMonths ?? listing.months, listing.months);
}

/** 정책 하나를 단독으로 받는다고 가정했을 때의 총 예상액. */
export function estimatePolicyAmount(policy: PolicyMeta, listing: ListingInput): number {
  const eligibleMonths = supportedMonths(policy, listing);

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

/**
 * 금액이 어떻게 나온 값인지 한 문장으로 설명한다 (F4-3).
 * 총액만 보여주면 "왜 이 금액인지"를 알 수 없고, 사용자가 검산할 수도 없다.
 */
export function benefitFormula(policy: PolicyMeta, listing: ListingInput): string {
  const total = estimatePolicyAmount(policy, listing);
  const months = supportedMonths(policy, listing);

  if (policy.benefitType === "rent_capped_monthly") {
    const monthly = monthlyRentEquivalent(listing);
    if (policy.monthlyCap == null) {
      return `월 환산 월세 ${won(monthly)} × ${months}개월 = ${won(total)}`;
    }
    return `월 환산 월세 ${won(monthly)}과 월 상한 ${won(policy.monthlyCap)} 중 작은 값 × ${months}개월 = ${won(total)}`;
  }

  if (policy.benefitType === "flat_monthly") {
    return `월 ${won(policy.monthlyCap ?? 0)} × ${months}개월 = ${won(total)}`;
  }

  return `실제 일시 지출 ${won(listing.oneTimeMoveCost)}과 상한 ${won(policy.lumpSumCap ?? 0)} 중 작은 값 = ${won(total)}`;
}

/** 언제 받는 돈인지 (F4-3). 계약 당일 목돈과 헷갈리지 않게 결과 카드에 함께 적는다. */
export function payoutTiming(policy: PolicyMeta): string {
  if (policy.benefitType === "lump_sum") return "1회 지급";
  return policy.maxMonths ? `매월 지급 · 최대 ${policy.maxMonths}개월` : "매월 지급 · 거주 기간 동안";
}

/**
 * 공고에 적힌 상한. 1층 목록에서 "이 정책이 최대 얼마짜리인가"를 보여주는 데 쓴다.
 *
 * 1층은 계약 조건을 모르므로 개인별 예상액을 계산할 수 없다 — 그건 2층의 일이다.
 * 그래서 화면에서는 반드시 '공고 상한'이라고 적어 개인 예상액과 구분한다.
 */
export function benefitCeiling(policy: PolicyMeta): { label: string; amount: number } | null {
  if (policy.benefitType === "lump_sum") {
    if (policy.lumpSumCap == null) return null;
    return { label: `최대 ${formatKoreanMoney(policy.lumpSumCap)}`, amount: policy.lumpSumCap };
  }

  if (policy.monthlyCap == null) return null;

  // 지원 개월 수가 정해지지 않은 정책(주거급여 분리지급)은 총액 상한이 없다.
  if (policy.maxMonths == null) {
    return { label: `월 최대 ${formatKoreanMoney(policy.monthlyCap)}`, amount: policy.monthlyCap };
  }

  const total = policy.monthlyCap * policy.maxMonths;
  return { label: `최대 ${formatKoreanMoney(total)}`, amount: total };
}

/**
 * 여러 정책 중 가장 큰 '총액 상한'. 목록 화면 헤드라인이 쓴다.
 *
 * 합산하지 않는다. 중복 수급 제한(exclusiveGroup) 때문에 상한을 더하면 실제로는
 * 받을 수 없는 금액이 된다. 정확한 조합은 계약 조건이 있어야 bestCombination 이
 * 계산할 수 있으므로 1층에서는 불가능하다 — 가장 큰 한 건만 말한다.
 *
 * 총액이 정해지지 않은 정책(지원 개월 수가 없는 주거급여 분리지급)은 후보에서
 * 뺀다. '월 21만원'과 '총 480만원'은 서로 비교할 수 있는 값이 아니라, 섞어서
 * 최댓값을 고르면 단위가 뒤엉킨 숫자가 헤드라인에 오른다.
 */
export function largestTotalCeiling(
  policies: PolicyMeta[]
): { label: string; amount: number } | null {
  const 총액있는것 = policies.filter(
    (p) => p.benefitType === "lump_sum" || (p.monthlyCap != null && p.maxMonths != null)
  );

  let best: { label: string; amount: number } | null = null;
  for (const policy of 총액있는것) {
    const ceiling = benefitCeiling(policy);
    if (ceiling && (best === null || ceiling.amount > best.amount)) best = ceiling;
  }
  return best;
}
