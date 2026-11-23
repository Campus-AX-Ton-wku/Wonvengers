import type { CalculationSummary, CheckOutcome, DeclaredValue, PolicyMeta } from "./types";

/**
 * 결과 전 '확인할 것' (11/23 ggue) — 조건을 확인하면 받을 수 있는 금액도 맨 위 합계에 넣되,
 * 그 조건은 결과를 보기 전에 **반드시** '해당해요' · '해당하지 않아요'로 답하게 한다('모름' 없음).
 *
 * 답은 직접 답한 조건 저장소(perky.declared, 계정에 저장)에 `confirm:<정책 id>:<조건 key>` 로 둔다.
 * 판정(lib/eligibility.ts)이 아직 모르는(unknown) 조건에만 이 답을 쓴다 — 판정 질문에 숫자를 넣어
 * 조건이 정해지면 그쪽이 이긴다. 해당해요 → 통과(합계에 남음), 해당하지 않아요 → 미충족(빠짐).
 */
export function confirmKey(policyId: string, checkKey: string): string {
  return `confirm:${policyId}:${checkKey}`;
}

/** 아직 모르는 조건에 '확인할 것' 답을 입힌다 */
export function applyConfirmations(
  policyId: string,
  checks: CheckOutcome[],
  declared: Record<string, DeclaredValue> | undefined
): CheckOutcome[] {
  return checks.map((check) => {
    if (check.result !== "unknown") return check;
    const answer = declared?.[confirmKey(policyId, check.key)];
    if (typeof answer !== "boolean") return check;
    return { ...check, result: answer ? "pass" : "fail", selfConfirmed: true };
  });
}

export interface PendingConfirmation {
  policy: PolicyMeta;
  /** 이 지원의 예상액 — 답에 따라 합계에서 빠질 수 있는 돈 */
  amount: number;
  /** 아직 답하지 않은 조건 */
  checks: CheckOutcome[];
}

/**
 * 결과를 보기 전에 답해야 할 조건 — 금액이 있는 '조건 충족 시 가능' 지원의 모르는 조건.
 * 금액이 0인 지원(정액 · 계산하지 않는 지원)은 합계를 바꾸지 않아 여기서 묻지 않는다(신청 준비에서 확인).
 */
export function pendingConfirmations(summary: CalculationSummary): PendingConfirmation[] {
  return summary.results
    .filter((r) => r.status === "조건충족시가능" && r.estimatedAmount > 0)
    .map((r) => ({ policy: r.policy, amount: r.estimatedAmount, checks: r.checks.filter((c) => c.result === "unknown") }))
    .filter((p) => p.checks.length > 0);
}

/** 맨 위 합계에 든 지원 중 직접 답해 정해진 조건 — 결과 화면이 '신청할 때 기관이 다시 확인해요'로 밝힌다 */
export function selfConfirmedConditions(summary: CalculationSummary): { policyId: string; policy: string; label: string }[] {
  const included = new Set(summary.bestCombination.includedPolicyIds);
  return summary.results
    .filter((r) => included.has(r.policy.id))
    .flatMap((r) =>
      r.checks.filter((c) => c.selfConfirmed && c.result === "pass").map((c) => ({ policyId: r.policy.id, policy: r.policy.name, label: c.label }))
    );
}

export interface ConfirmItem {
  policy: PolicyMeta;
  amount: number;
  /** 답할 조건 — 아직 모르는 것과 이미 직접 답한 것(고칠 수 있게) */
  checks: CheckOutcome[];
}

/**
 * '확인할 것' 화면에 보일 조건 — 금액이 있는 지원의, 아직 모르거나 직접 답한 조건.
 * 직접 답해서 '해당하지 않아요'로 빠진 지원도 다시 고칠 수 있게 둔다(그때 금액은 판정과 따로 센다).
 * 다른 조건(나이 · 소득 등)으로 이미 탈락한 지원과 접수 기간 밖 지원은 묻지 않는다.
 */
export function confirmItems(
  summary: CalculationSummary,
  amountOf: (policy: PolicyMeta) => number
): ConfirmItem[] {
  return summary.results
    .filter((r) => r.status !== "신청불가")
    .flatMap((r) => {
      const checks = r.checks.filter((c) => c.result === "unknown" || c.selfConfirmed);
      if (checks.length === 0) return [];
      if (r.checks.some((c) => c.result === "fail" && !c.selfConfirmed)) return [];
      const amount = r.estimatedAmount > 0 ? r.estimatedAmount : amountOf(r.policy);
      return amount > 0 ? [{ policy: r.policy, amount, checks }] : [];
    });
}
