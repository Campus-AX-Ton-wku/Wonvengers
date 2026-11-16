import type { ChecklistState } from "./user-data";
import type { PolicyMeta } from "./types";

/** 신청 준비 진행률 · 마감 표시 (docs/기획/2026-11-17-홈-찜하기-설계.md "2 · 3"). */

function documentsDone(policy: PolicyMeta, checked: readonly string[]): number {
  const names = new Set((policy.documents ?? []).map((d) => d.name));
  return checked.filter((n) => names.has(n)).length;
}

const checksDone = (c: ChecklistState) => [c.eligibility, c.period, c.documents].filter(Boolean).length;

/** 홈 카드: 서류 목록이 있으면 서류만, 없으면 확인 3개. */
export function homeProgress(policy: PolicyMeta, checklist: ChecklistState, checked: readonly string[]) {
  const docs = policy.documents ?? [];
  if (docs.length > 0) {
    const done = documentsDone(policy, checked);
    return { kind: "documents" as const, done, total: docs.length, label: `서류 ${done}/${docs.length} 준비` };
  }
  const done = checksDone(checklist);
  return { kind: "checks" as const, done, total: 3, label: `확인 ${done}/3` };
}

/** 체크리스트 화면: 서류 있으면 자격 + 기간 + 서류 하나하나. */
export function pageProgress(policy: PolicyMeta, checklist: ChecklistState, checked: readonly string[]) {
  const docs = policy.documents ?? [];
  if (docs.length === 0) return { done: checksDone(checklist), total: 3 };
  const fixed = [checklist.eligibility, checklist.period].filter(Boolean).length;
  return { done: fixed + documentsDone(policy, checked), total: 2 + docs.length };
}

const DAY = 86_400_000;

export function deadlineLabel(policy: PolicyMeta, todayISO: string): string {
  if (todayISO < policy.applicationStart) return "신청 예정";
  if (policy.applicationEnd === null) return "상시";
  if (todayISO > policy.applicationEnd) return "접수 마감";
  const days = Math.round((Date.parse(policy.applicationEnd) - Date.parse(todayISO)) / DAY);
  return days === 0 ? "오늘 마감" : `D-${days}`;
}
