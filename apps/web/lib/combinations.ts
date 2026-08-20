import type { CombinationResult, PolicyResult } from "./types";

function isValidCombination(subset: PolicyResult[]): boolean {
  const seenGroups = new Set<string>();
  for (const r of subset) {
    for (const group of r.policy.exclusiveGroup) {
      if (seenGroups.has(group)) return false;
      seenGroups.add(group);
    }
  }
  return true;
}

/**
 * 예상 적용·조건 충족 시 가능 정책 중, 중복 제한을 위반하지 않으면서
 * 총액이 가장 큰 조합을 찾는다 (F3-8). 정책 수가 적어(3~5개) 전수 탐색으로 충분하다.
 */
export function bestCombination(results: PolicyResult[]): CombinationResult {
  const candidates = results.filter(
    (r) => r.status === "예상적용" || r.status === "조건충족시가능"
  );
  const n = candidates.length;
  let best: CombinationResult = { includedPolicyIds: [], totalAmount: 0 };

  for (let mask = 0; mask < 1 << n; mask++) {
    const subset = candidates.filter((_, i) => (mask & (1 << i)) !== 0);
    if (!isValidCombination(subset)) continue;
    const total = subset.reduce((sum, r) => sum + r.estimatedAmount, 0);
    if (total > best.totalAmount) {
      best = { includedPolicyIds: subset.map((r) => r.policy.id), totalAmount: total };
    }
  }

  return best;
}
