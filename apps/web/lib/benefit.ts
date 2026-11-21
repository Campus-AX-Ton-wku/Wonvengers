import type { BenefitType, ListingInput, PolicyMeta } from "./types";
import { calcMonths, monthlyRentEquivalent } from "./rent";
import { formatKoreanMoney } from "./money";
import { formatDotDate } from "./date";

const won = (amount: number) => `${amount.toLocaleString()}원`;

const BENEFIT_TYPE_LABEL: Record<BenefitType, string> = {
  rent_capped_monthly: "월세 지원 · 실제 월세 범위 내",
  flat_monthly: "정액 지원 · 월 고정액",
  lump_sum: "일시금 지원 · 실비",
};

/**
 * 지원 형태를 사람이 읽는 말로. 화면에 benefitType 을 그대로 찍으면 영문 코드가 노출된다.
 * 정액 일시금(lumpSumBasis "fixedGrant")은 실비가 아니므로 따로 적는다.
 */
export function benefitTypeLabel(type: BenefitType, basis?: PolicyMeta["lumpSumBasis"]): string {
  if (type === "lump_sum" && basis === "fixedGrant") return "일시금 지원 · 정액";
  return BENEFIT_TYPE_LABEL[type];
}

/**
 * 나이를 '신청할 때 한 번'만 보는 지원 (11/21 ggue — 나이 상한 정책별 구분).
 *
 * 입력한 거주 개월 수를 그대로 세면 나이 상한을 넘는 기간까지 지원이 붙는다. 그런데 정책마다 나이를
 * 보는 때가 다르다 — 공고가 출생연도나 기준일로 나이를 정하면 신청할 때 한 번 판정하고, 선정되면 정한
 * 기간만큼 준다. 여기 있는 정책은 자르지 않는다. **여기 없는 정책은 '받는 동안 계속' 본다고 보고
 * 만 (상한+1)세 생일 전까지만 센다** — 모르는 정책을 부풀리지 않는 쪽이 안전하다(F0-5). 새 정책이
 * 공고에서 출생연도 · 기준일로 나이를 정하면 근거와 함께 여기 넣는다. 근거는 Supabase policies.notes.
 *
 * '받는 동안 계속'으로 두는 정책: 청년 주거급여 분리지급 — '만 19세 이상 30세 미만 미혼 청년'이라는
 * 지금 상태가 조건이고 지급 기간 상한이 없다.
 */
export const AGE_CHECKED_AT_APPLICATION: ReadonlySet<string> = new Set([
  "moland-youth-rent-support", // 2026 공고 '만 19~34세(1991~2007년생)', 최대 24회 생애 1회
  "iksan-youth-rent-support", // 2026 공고 '19~34세(1991~2007년생)', 최대 12개월 생애 1회
  "jeonbuk-youth-settlement-support", // 2026 수정공고 '나이는 2025-12-31 기준 18~39세', 최대 12개월
]);

function ymd(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * startISO 부터 만 (ageMax + 1)세 생일 전까지 '다 채운 달' 수. 생일이 낀 달은 세지 않는다 —
 * 그달 지급 여부는 모르니 부풀리지 않는다. 시작 때 이미 넘었으면 0. 날짜를 못 읽으면 Infinity(자르지 않음).
 */
export function monthsBeforeAgeLimit(birthDate: string, ageMax: number, startISO: string): number {
  const birth = ymd(birthDate);
  const start = ymd(startISO);
  if (!birth || !start) return Infinity;
  const [outY, outM, outD] = [birth[0] + ageMax + 1, birth[1], birth[2]];
  const months = (outY - start[0]) * 12 + (outM - start[1]) - (outD < start[2] ? 1 : 0);
  return Math.max(0, months);
}

/** 나이 상한 때문에 지원 개월이 줄었을 때 — 몇 개월로 셌는지와 상한을 넘는 날(만 ageMax+1 세 생일). */
export interface AgeLimitedMonths {
  months: number;
  ageMax: number;
  endDate: string;
}

/**
 * 이 지원을 나이 상한에서 잘라야 하면 그 정보, 아니면 null (자르지 않았거나 상한에 닿지 않음).
 * 월 단위 지원만 본다 — 일시금은 한 번 받는 돈이라 기간이 없다. 생년월일을 모르면 자르지 않는다.
 */
export function supportAgeLimit(policy: PolicyMeta, listing: ListingInput, birthDate?: string): AgeLimitedMonths | null {
  if (policy.benefitType !== "rent_capped_monthly" && policy.benefitType !== "flat_monthly") return null;
  const ageMax = policy.discovery.ageMax;
  if (!birthDate || ageMax == null || AGE_CHECKED_AT_APPLICATION.has(policy.id)) return null;
  const months = monthsBeforeAgeLimit(birthDate, ageMax, listing.contractStartDate);
  if (months >= baseMonths(policy, listing)) return null;
  const birth = ymd(birthDate)!;
  const endDate = `${birth[0] + ageMax + 1}-${String(birth[1]).padStart(2, "0")}-${String(birth[2]).padStart(2, "0")}`;
  return { months, ageMax, endDate };
}

/**
 * 정책의 지원 개월 상한과 계산 기간(거주 예정 개월 수) 중 작은 값.
 * 주거비(rent.ts nominalTotalCost)와 같은 기간으로 센다 — 기간이 다르면 지원이 주거비보다 커진다(11/21).
 */
function baseMonths(policy: PolicyMeta, listing: ListingInput): number {
  const months = calcMonths(listing);
  return Math.min(policy.maxMonths ?? months, months);
}

/** baseMonths 에서 나이 상한(받는 동안 나이를 따지는 지원)까지 반영한 지원 개월 수. */
function supportedMonths(policy: PolicyMeta, listing: ListingInput, birthDate?: string): number {
  return supportAgeLimit(policy, listing, birthDate)?.months ?? baseMonths(policy, listing);
}

/**
 * 정책 하나를 단독으로 받는다고 가정했을 때의 총 예상액.
 * birthDate 를 주면 받는 동안 나이를 따지는 지원은 나이 상한 전까지만 센다(supportAgeLimit).
 */
export function estimatePolicyAmount(policy: PolicyMeta, listing: ListingInput, birthDate?: string): number {
  const eligibleMonths = supportedMonths(policy, listing, birthDate);

  if (policy.benefitType === "rent_capped_monthly") {
    const monthly = Math.min(policy.monthlyCap ?? Infinity, monthlyRentEquivalent(listing));
    return Math.max(0, Math.round(monthly * eligibleMonths));
  }

  if (policy.benefitType === "flat_monthly") {
    return Math.max(0, Math.round((policy.monthlyCap ?? 0) * eligibleMonths));
  }

  // lump_sum — 2층이 그 지출을 입력받는 정책만 계산한다 (types.ts 의 lumpSumBasis).
  if (policy.lumpSumBasis !== "oneTimeMoveCost") return 0;
  return Math.min(policy.lumpSumCap ?? Infinity, listing.oneTimeMoveCost);
}

/**
 * 매달 주는 지원이면 한 달 금액과 개월 수 (11/18). 결과 카드가 총액만 크게 쓰고 아래에 '매월 지급'을
 * 붙이면 '매달 254만원'으로 읽힌다 — 한 달 금액을 크게, 개월 합계를 작게 쓰려고 나눈다.
 * 일시금은 null.
 */
export function monthlyBreakdown(
  policy: PolicyMeta,
  listing: ListingInput,
  birthDate?: string
): { monthly: number; months: number } | null {
  if (policy.benefitType !== "rent_capped_monthly" && policy.benefitType !== "flat_monthly") return null;
  const months = supportedMonths(policy, listing, birthDate);
  if (months <= 0) return null;
  const monthly =
    policy.benefitType === "rent_capped_monthly"
      ? Math.min(policy.monthlyCap ?? Infinity, monthlyRentEquivalent(listing))
      : policy.monthlyCap ?? 0;
  return { monthly: Math.round(monthly), months };
}

/**
 * 금액이 어떻게 나온 값인지 한 문장으로 설명한다 (F4-3).
 * 총액만 보여주면 "왜 이 금액인지"를 알 수 없고, 사용자가 검산할 수도 없다.
 */
export function benefitFormula(policy: PolicyMeta, listing: ListingInput, birthDate?: string): string {
  const total = estimatePolicyAmount(policy, listing, birthDate);
  const months = supportedMonths(policy, listing, birthDate);
  // 입력한 개월 수보다 적게 셌으면 왜 그런지 식 끝에 붙인다
  const limit = supportAgeLimit(policy, listing, birthDate);
  const why = limit ? ` (${ageLimitReason(limit)})` : "";

  if (policy.benefitType === "rent_capped_monthly") {
    const monthly = monthlyRentEquivalent(listing);
    if (policy.monthlyCap == null) {
      return `월 환산 월세 ${won(monthly)} × ${months}개월 = ${won(total)}${why}`;
    }
    return `월 환산 월세 ${won(monthly)}과 월 상한 ${won(policy.monthlyCap)} 중 작은 값 × ${months}개월 = ${won(total)}${why}`;
  }

  if (policy.benefitType === "flat_monthly") {
    return `월 ${won(policy.monthlyCap ?? 0)} × ${months}개월 = ${won(total)}${why}`;
  }

  if (policy.lumpSumBasis === "fixedGrant") {
    return `계약 조건과 무관하게 공고가 정한 금액을 주는 지원이라 예상액에 넣지 않습니다 (공고 금액 최대 ${won(policy.lumpSumCap ?? 0)})`;
  }
  // 이사비는 11/21 부터 입력받지 않아 늘 0 이다 — '0원과 상한 중 작은 값 = 0원'이라고 쓰면 못 받는 돈처럼 읽힌다
  if (policy.lumpSumBasis !== "oneTimeMoveCost" || listing.oneTimeMoveCost <= 0) {
    return `이 화면은 이 지원금이 보는 지출을 입력받지 않아 예상액을 계산하지 않습니다 (공고 상한 ${won(policy.lumpSumCap ?? 0)})`;
  }
  return `실제 일시 지출 ${won(listing.oneTimeMoveCost)}과 상한 ${won(policy.lumpSumCap ?? 0)} 중 작은 값 = ${won(total)}`;
}

/** '만 30세가 되는 2028.05.10 전까지' — 나이 상한으로 지원 개월이 줄어든 이유. */
export function ageLimitReason(limit: AgeLimitedMonths): string {
  return `만 ${limit.ageMax + 1}세가 되는 ${formatDotDate(limit.endDate)} 전까지`;
}

/** 언제 받는 돈인지 (F4-3). 계약 당일 목돈과 헷갈리지 않게 결과 카드에 함께 적는다. */
export function payoutTiming(policy: PolicyMeta): string {
  if (policy.benefitType === "lump_sum") return policy.payoutNote ?? "1회 지급";
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
