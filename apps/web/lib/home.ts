// apps/web/lib/home.ts
import { resolveAnswers } from "./age";
import { applicationOpenCount, groupPolicies } from "./discovery";
import { deadlineLabel, homeProgress } from "./preparation";
import type { DiscoveryAnswers, PolicyMeta } from "./types";
import type { ChecklistState } from "./user-data";

/** 홈 화면 계산 (docs/기획/2026-11-17-홈-찜하기-설계.md "2. 홈 화면"). 화면 없이 값만. */
export function availableCount(policies: PolicyMeta[], answers: DiscoveryAnswers, todayISO: string): number | null {
  if (Object.values(answers).every((v) => v === null)) return null;
  return applicationOpenCount(groupPolicies(policies, resolveAnswers(answers, todayISO)), todayISO);
}

export function savedCards(
  policies: PolicyMeta[],
  saved: readonly string[],
  todayISO: string,
  read: { checklist(id: string): ChecklistState; documents(id: string): string[] }
): { policy: PolicyMeta; deadline: string; progress: string }[] {
  const byId = new Map(policies.map((p) => [p.id, p]));
  return saved.flatMap((id) => {
    const policy = byId.get(id);
    if (!policy) return [];
    return [{
      policy,
      deadline: deadlineLabel(policy, todayISO),
      progress: homeProgress(policy, read.checklist(id), read.documents(id)).label,
    }];
  });
}
