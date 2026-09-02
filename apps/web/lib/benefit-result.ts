import { benefitCeiling, benefitTypeLabel, payoutTiming } from "./benefit";
import type { CalculationSummary, PolicyResult } from "./types";
import { formatDotDate } from "./date";

/** Figma Benefit Result Card가 소비하는, 앱 데이터에서 파생한 표시 계약이다. */
export type BenefitResultState = "eligible" | "check" | "urgent";

export interface BenefitResultCardData {
  state: BenefitResultState;
  policyId: string;
  title: string;
  agency: string;
  amount: { value: number; unit: "원"; period: string; isMaximum: boolean };
  evidence: { matchedCount: number; missingCount: number; message: string };
  /** 원본 공고에는 날짜만 있어, 시간은 임의로 만들지 않고 YYYY-MM-DD를 보존한다. */
  deadlineAt: string | null;
  deadlineDays: number | null;
  steps: Array<{ label: string; value: string; tone: "ok" | "warn" | "danger" | "neutral"; href?: string }>;
  source: { name: string; updatedAt: string | null; url: string };
  primaryAction: { label: string; kind: "prepare" | "review"; href: string };
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
  if (result.unknownLabels.length > 0) return result.unknownLabels.slice(0, 2).join(" · ");
  return `확인한 조건 ${result.passedLabels.length}개가 모두 일치해요.`;
}

export function toBenefitResultCardData(result: PolicyResult, asOfISO: string): BenefitResultCardData | null {
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
  const detailHref = `/find/policies/${policy.id}`;
  const prepareHref = `${detailHref}/prepare`;

  return {
    state,
    policyId: policy.id,
    title: policy.name,
    agency: policy.agency,
    amount: {
      value: amountValue,
      unit: "원",
      period: result.estimatedAmount > 0 ? payoutTiming(policy) : `개인 예상액 계산 전 · ${payoutTiming(policy)}`,
      isMaximum,
    },
    evidence: { matchedCount, missingCount, message: evidenceMessage(result) },
    deadlineAt: deadline,
    deadlineDays: deadline ? daysUntil(asOfISO, deadline) : null,
    steps: [
      {
        label: "자격 요건",
        value: missingCount > 0 ? `확인 필요 ${missingCount}개` : `확인 완료 ${matchedCount}개`,
        tone: missingCount > 0 ? "warn" : "ok",
        href: missingCount > 0 ? "/eligibility" : undefined,
      },
      {
        label: "지원 형태",
        value: benefitTypeLabel(policy.benefitType),
        tone: "neutral",
      },
      {
        label: "신청 방식",
        value: state === "check" ? "조건 확인 후 안내" : "공식 신청 페이지에서 진행",
        tone: state === "urgent" ? "danger" : state === "check" ? "neutral" : "ok",
        // 외부 applyUrl은 신청 준비 화면의 출처 안내를 거친 뒤에만 연다.
        href: state === "check" ? undefined : prepareHref,
      },
    ],
    source: { name: policy.agency, updatedAt: policy.verifiedAt, url: policy.sourceUrl },
    primaryAction: state === "check"
      ? { label: `조건 ${missingCount}개 확인하기`, kind: "review", href: "/eligibility" }
      : {
          label: state === "urgent" ? "마감 전 신청 준비하기" : "신청 준비 시작하기",
          kind: "prepare",
          href: detailHref,
        },
  };
}

export function isExpiredResult(result: PolicyResult, asOfISO: string): boolean {
  return result.policy.applicationEnd !== null && daysUntil(asOfISO, result.policy.applicationEnd) < 0;
}

export function benefitResultCards(results: PolicyResult[], asOfISO: string): BenefitResultCardData[] {
  const order: Record<BenefitResultState, number> = { urgent: 0, eligible: 1, check: 2 };
  return results
    .map((result) => toBenefitResultCardData(result, asOfISO))
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
