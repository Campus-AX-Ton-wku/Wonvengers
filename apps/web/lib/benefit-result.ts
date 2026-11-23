import { benefitCeiling, payoutTiming } from "./benefit";
import type { CalculationSummary, PolicyResult } from "./types";
import { formatDotDate } from "./date";

/** Figma Benefit Result Card가 소비하는, 앱 데이터에서 파생한 표시 계약이다. */
export type BenefitResultState = "eligible" | "check" | "urgent";

export interface BenefitResultCardData {
  state: BenefitResultState;
  policyId: string;
  title: string;
  agency: string;
  amount: {
    value: number;
    unit: "원";
    /** 지급 방식 한 줄 (매월 지급 · 거주 기간 동안 / 첫 학기 30만원 · 이후 학기마다 10만원 …) */
    period: string;
    isMaximum: boolean;
    /**
     * 이 금액이 결과 화면 맨 위 '최대 지원 가능액' 합계에 들어갔는가(11/17).
     * 들어간 금액만 금색으로 그린다 — 합계에 없는 공고 금액을 같은 금색 상자에 두면
     * 사용자는 카드 금액을 모두 더한 값을 받는다고 읽는다.
     */
    countsInTotal: boolean;
    /** 합계에 들어가지 않은 이유. 들어갔으면 null */
    note: string | null;
    /** 이유의 종류 — 카드는 중복(overlap)만 따로 적고, 나머지는 '더 받을 수 있는 지원' 묶음 설명이 한 번 한다 */
    excludedReason: "unconfirmed" | "overlap" | "fixedGrant" | "notCalculated" | null;
  };
  evidence: { matchedCount: number; missingCount: number; message: string };
  /** 원본 공고에는 날짜만 있어, 시간은 임의로 만들지 않고 YYYY-MM-DD를 보존한다. */
  deadlineAt: string | null;
  deadlineDays: number | null;
  source: { name: string; updatedAt: string | null; url: string };
  primaryAction: { label: string; kind: "prepare"; href: string };
}

/** YYYY-MM-DD 두 값을 시간대 변화 없이 달력 날짜로 비교한다. */
export function daysUntil(asOfISO: string, deadlineISO: string): number {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return Number.NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  return Math.round((parse(deadlineISO) - parse(asOfISO)) / 86_400_000);
}

/**
 * Figma handoff 우선순위: 확인할 정보가 있으면 check, 모두 확인되고 마감 0~7일이면
 * urgent, 그 외 신청 가능한 결과는 eligible이다. 기존 정책 판정 결과를 바꾸지 않고
 * 화면 variant만 이 함수에서 정한다.
 */
export function benefitResultState(result: PolicyResult, asOfISO: string): BenefitResultState | null {
  // Figma 계약상 신청 불가·대상 아님은 세 variant에 억지로 넣지 않는다.
  if (result.status === "대상아님" || result.status === "신청불가") return null;
  if (result.status === "조건충족시가능" || result.unknownLabels.length > 0) return "check";
  const { applicationEnd } = result.policy;
  if (applicationEnd !== null) {
    const remaining = daysUntil(asOfISO, applicationEnd);
    if (remaining >= 0 && remaining <= 7) return "urgent";
  }
  return "eligible";
}

function evidenceMessage(result: PolicyResult): string {
  if (result.unknownLabels.length > 0) {
    // unknownLabels에는 상세 확인 방법까지 붙어 있어 카드에 그대로 넣으면 긴 문단이
    // 된다. 카드는 조건명만 요약하고, 방법은 정책별 확인 화면에서 한 항목씩 보여준다.
    const labels = result.checks
      .filter((check) => check.result === "unknown")
      .map((check) => check.label);
    const summary = labels.length > 0 ? labels : result.unknownLabels;
    const more = summary.length > 2 ? ` 외 ${summary.length - 2}개` : "";
    return `${summary.slice(0, 2).join(" · ")}${more}`;
  }
  return `확인한 조건 ${result.passedLabels.length}개가 모두 일치해요.`;
}

/**
 * @param includedPolicyIds 맨 위 합계(최선 조합)에 든 정책 id. 안 넘기면 예상액이 있는지로 본다.
 */
export function toBenefitResultCardData(
  result: PolicyResult,
  asOfISO: string,
  includedPolicyIds?: ReadonlySet<string>
): BenefitResultCardData | null {
  const { policy } = result;
  const state = benefitResultState(result, asOfISO);
  if (state === null) return null;
  const matchedCount = result.passedLabels.length;
  const missingCount = result.unknownLabels.length;
  const deadline = policy.applicationEnd;
  const ceiling = benefitCeiling(policy);
  // 개인별 금액을 계산할 수 없는 정책만 공고 상한으로 보완한다. 둘 다 실제 정책 데이터다.
  const amountValue = result.estimatedAmount > 0 ? result.estimatedAmount : ceiling?.amount ?? 0;
  const isMaximum = ceiling !== null && amountValue === ceiling.amount;
  const prepareHref = `/find/policies/${policy.id}/prepare`;
  const counted = result.estimatedAmount > 0 && (includedPolicyIds?.has(policy.id) ?? true);
  // 11/23 ggue: 맨 위 합계는 확인이 끝난('예상 적용') 지원만 — 확인할 조건이 남은 지원은 금액이 있어도 합계 밖
  const excludedReason: BenefitResultCardData["amount"]["excludedReason"] = counted
    ? null
    : result.estimatedAmount > 0 && result.status === "조건충족시가능"
      ? "unconfirmed"
      : result.estimatedAmount > 0
      ? "overlap"
      : policy.lumpSumBasis === "fixedGrant"
        ? "fixedGrant"
        : "notCalculated";
  const note =
    excludedReason === "unconfirmed"
      ? "확인할 조건이 남아 위 합계에는 넣지 않았어요"
      : excludedReason === "overlap"
      ? "같이 받을 수 없는 지원과 겹쳐 위 합계에서 뺐어요"
      : excludedReason === "fixedGrant"
        ? "정해진 금액이라 위 합계에는 넣지 않았어요"
        : excludedReason === "notCalculated"
          ? "이 화면에서 계산하지 않는 지원이라 위 합계에는 넣지 않았어요"
          : null;

  return {
    state,
    policyId: policy.id,
    title: policy.name,
    agency: policy.agency,
    amount: {
      value: amountValue,
      unit: "원",
      period: payoutTiming(policy),
      isMaximum,
      countsInTotal: counted,
      note,
      excludedReason,
    },
    evidence: { matchedCount, missingCount, message: evidenceMessage(result) },
    deadlineAt: deadline,
    deadlineDays: deadline ? daysUntil(asOfISO, deadline) : null,
    source: { name: policy.agency, updatedAt: policy.verifiedAt, url: policy.sourceUrl },
    // 확인 필요도 결과 화면에서 조건을 따지게 하지 않는다(11/17) — 신청 준비로 이어 가고,
    // 정책별 조건은 신청 준비 체크리스트의 '자격 조건 확인'에 적는다(lib/preparation.ts conditionsToConfirm).
    primaryAction: {
      label: state === "urgent" ? "마감 전 신청 준비하기" : "신청 준비 시작하기",
      kind: "prepare",
      href: prepareHref,
    },
  };
}

export function isExpiredResult(result: PolicyResult, asOfISO: string): boolean {
  return result.policy.applicationEnd !== null && daysUntil(asOfISO, result.policy.applicationEnd) < 0;
}

export function benefitResultCards(
  results: PolicyResult[],
  asOfISO: string,
  includedPolicyIds?: ReadonlySet<string>
): BenefitResultCardData[] {
  const order: Record<BenefitResultState, number> = { urgent: 0, eligible: 1, check: 2 };
  return results
    .map((result) => toBenefitResultCardData(result, asOfISO, includedPolicyIds))
    .filter((card): card is BenefitResultCardData => card !== null)
    .sort((a, b) => order[a.state] - order[b.state]);
}

export type ResultAvailability = "ready" | "empty" | "expired";

/** 결과 후보가 없을 때, 전부 지난 접수 회차인 경우만 Expired로 분리한다. */
export function resultAvailability(summary: CalculationSummary, asOfISO: string): ResultAvailability {
  if (benefitResultCards(summary.results, asOfISO).length > 0) return "ready";
  const allClosed =
    summary.results.length > 0 &&
    summary.results.every((result) => result.status === "신청불가" && isExpiredResult(result, asOfISO));
  return allClosed ? "expired" : "empty";
}

export function formatDeadline(deadlineISO: string): string {
  const [year, month, day] = deadlineISO.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return formatDotDate(deadlineISO);
  return `${month}월 ${day}일`;
}
