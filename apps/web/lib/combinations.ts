import type { CombinationResult, PolicyMeta, PolicyResult } from "./types";

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

export interface OverlapExclusion {
  policy: PolicyMeta;
  /** 이 정책과 같은 배타 그룹에 있으면서 조합에 들어간 정책 이름들 */
  conflictsWith: string[];
}

/**
 * 자격은 되지만 중복 제한 때문에 최적 조합에서 빠진 정책 (F4-5).
 *
 * 조용히 빠지면 사용자는 "왜 이 정책이 최대 지원 가능액에 없지?"를 알 수 없다.
 * 금액이 0이라 빠진 정책은 중복 제한과 무관하므로 여기 넣지 않는다.
 */
export function excludedByOverlap(
  results: PolicyResult[],
  combination: CombinationResult
): OverlapExclusion[] {
  const included = results.filter((r) => combination.includedPolicyIds.includes(r.policy.id));
  const dropped = results.filter(
    (r) =>
      (r.status === "예상적용" || r.status === "조건충족시가능") &&
      !combination.includedPolicyIds.includes(r.policy.id)
  );

  return dropped.flatMap((r) => {
    const conflictsWith = included
      .filter((inc) => inc.policy.exclusiveGroup.some((g) => r.policy.exclusiveGroup.includes(g)))
      .map((inc) => inc.policy.name);
    return conflictsWith.length > 0 ? [{ policy: r.policy, conflictsWith }] : [];
  });
}
