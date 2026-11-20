// apps/web/lib/home.ts
import { resolveAnswers } from "./age";
import { groupPolicies, splitByApplicationWindow } from "./discovery";
import { deadlineLabel, homeProgress } from "./preparation";
import type { DiscoveryAnswers, PolicyMeta } from "./types";
import type { ChecklistState } from "./user-data";

/** 홈 화면 계산 (docs/기획/2026-11-17-홈-찜하기-설계.md "2. 홈 화면"). 화면 없이 값만. */

/**
 * 지금 신청할 수 있는 정책. 목록 화면(/find/policies)이 보여 주는 것과 같은 것, 같은 순서다 —
 * 홈 미리 보기에서 [모두 보기]를 눌렀을 때 같은 카드가 같은 자리에서 이어져야 한다.
 * 답이 하나도 없으면 null.
 */
export function openPolicies(policies: PolicyMeta[], answers: DiscoveryAnswers, todayISO: string): PolicyMeta[] | null {
  if (Object.values(answers).every((v) => v === null)) return null;
  const groups = groupPolicies(policies, resolveAnswers(answers, todayISO));
  return splitByApplicationWindow(groups, todayISO).신청가능.map((t) => t.policy);
}

export function availableCount(policies: PolicyMeta[], answers: DiscoveryAnswers, todayISO: string): number | null {
  return openPolicies(policies, answers, todayISO)?.length ?? null;
}

export type SavedCard = { policy: PolicyMeta; deadline: string; progress: ReturnType<typeof homeProgress> };

export function savedCards(
  policies: PolicyMeta[],
  saved: readonly string[],
  todayISO: string,
  read: { checklist(id: string): ChecklistState; documents(id: string): string[] }
): SavedCard[] {
  const byId = new Map(policies.map((p) => [p.id, p]));
  return saved.flatMap((id) => {
    const policy = byId.get(id);
    if (!policy) return [];
    return [{
      policy,
      deadline: deadlineLabel(policy, todayISO),
      progress: homeProgress(policy, read.checklist(id), read.documents(id)),
    }];
  });
}

export type SavedSort = "deadline" | "recent";

/**
 * 관심 탭의 정렬 (11/20). "recent"는 찜한 순서 그대로(최근 것이 앞 — lib/saved.ts).
 * "deadline"은 지금 할 일이 급한 순서:
 *   1. 마감일이 있는 접수 중 — 남은 날이 적은 순 (오늘 마감 → D-1 → …)
 *   2. 상시 접수
 *   3. 신청 예정 — 열리는 날이 가까운 순
 *   4. 접수 마감
 * 같은 칸 안에서는 찜한 순서를 지킨다(Array.prototype.sort 는 안정 정렬).
 */
export function sortSavedCards(cards: readonly SavedCard[], sort: SavedSort, todayISO: string): SavedCard[] {
  if (sort === "recent") return [...cards];
  const rank = ({ policy }: SavedCard): [number, string] => {
    if (todayISO < policy.applicationStart) return [2, policy.applicationStart];
    if (policy.applicationEnd === null) return [1, ""];
    if (todayISO > policy.applicationEnd) return [3, ""];
    return [0, policy.applicationEnd];
  };
  return [...cards].sort((a, b) => {
    const [ga, ka] = rank(a);
    const [gb, kb] = rank(b);
    return ga !== gb ? ga - gb : ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** 지금은 신청할 수 없는 마감 표시 (lib/preparation.ts deadlineLabel). */
export function isClosedDeadline(deadline: string): boolean {
  return deadline === "접수 마감" || deadline === "신청 예정";
}

export type HomePose = "empty" | "success" | "found";

/**
 * 요약 카드에 걸터앉는 Perky 포즈 — 위에서부터 먼저 맞는 하나만 (디자인 시안 '마스코트 배치 가이드').
 *  1. 지금 신청할 수 있는 게 0건 → empty
 *  2. 지금 신청할 수 있는 찜이 모두 준비 끝 → success ("이제 신청만 남았어요")
 *  3. 그 밖 → found
 * 마감·예정인 찜은 2번에서 따지지 않는다. 준비를 마쳐도 지금은 신청할 수 없다.
 */
export function homePose(count: number, cards: readonly SavedCard[]): HomePose {
  if (count === 0) return "empty";
  const open = cards.filter((c) => !isClosedDeadline(c.deadline));
  if (open.length > 0 && open.every((c) => c.progress.done >= c.progress.total)) return "success";
  return "found";
}
