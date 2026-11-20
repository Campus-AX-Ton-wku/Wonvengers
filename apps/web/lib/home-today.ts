import { daysBetween, inboxItems, UPCOMING_DAYS } from "./inbox";
import { isClosedDeadline, savedCards } from "./home";
import type { homeProgress } from "./preparation";
import type { DiscoveryAnswers, PolicyMeta } from "./types";
import type { ChecklistState } from "./user-data";

/**
 * 홈 보강 — 오늘 할 일 · 다가오는 일정 (docs/기획/2026-11-20-홈-보강-설계.md 3 · 4절). 화면 없이 값만.
 * lib/home.ts 가 아니라 따로 둔다 — lib/inbox.ts 가 lib/home.ts 를 가져오므로 거기서 inbox 를 쓰면 순환 import 가 된다.
 * 기준(7 · 14 · 30일)과 '새 지원금' · '새로 열림' 판정은 알림함 것을 그대로 쓴다 — 홈과 알림함이 어긋나지 않게.
 */

type Progress = ReturnType<typeof homeProgress>;
type Read = { checklist(id: string): ChecklistState; documents(id: string): string[] };

export type TodoItem =
  | { kind: "deadline"; policy: PolicyMeta; days: number; progress: Progress }
  | { kind: "starts-today"; policy: PolicyMeta }
  | { kind: "new"; policy: PolicyMeta; tag: "가능성 있음" | "확인 필요" }
  | { kind: "opened"; policy: PolicyMeta; days: number }
  | { kind: "calc" }
  | { kind: "stalled"; policy: PolicyMeta; progress: Progress };

/**
 * 오늘 할 일 — 위에서부터 처음 걸리는 하나. more 는 1~3순위에 함께 걸린 다른 항목 수(알림함에서 본다).
 *  1. 관심 지원금 마감 7일 이하(가까운 순)   2. 관심 지원금 신청이 오늘 시작(관심에 담은 순)
 *  3. 새 지원금 · 새로 열림(알림함 순서)     4. 계산 전                      5. 준비하다 멈춘 관심 지원금
 * 한 정책은 한 번 — 위 순위가 먼저 가져간다.
 */
export function todayTodo(
  policies: PolicyMeta[],
  answers: DiscoveryAnswers,
  saved: readonly string[],
  todayISO: string,
  read: Read,
  calculated: boolean
): { item: TodoItem | null; more: number } {
  const inbox = inboxItems(policies, answers, saved, todayISO, read);
  const cards = savedCards(policies, saved, todayISO, read);

  const urgent: TodoItem[] = [];
  const taken = new Set<string>();
  for (const i of inbox) {
    if (i.kind !== "deadline") continue;
    urgent.push({ kind: "deadline", policy: i.policy, days: i.days, progress: i.card.progress });
    taken.add(i.policy.id);
  }
  for (const c of cards) {
    if (c.policy.applicationStart !== todayISO || taken.has(c.policy.id)) continue;
    urgent.push({ kind: "starts-today", policy: c.policy });
    taken.add(c.policy.id);
  }
  for (const i of inbox) {
    if (taken.has(i.policy.id)) continue;
    if (i.kind === "new") urgent.push({ kind: "new", policy: i.policy, tag: i.tag });
    else if (i.kind === "opened") urgent.push({ kind: "opened", policy: i.policy, days: i.days });
  }
  if (urgent.length > 0) return { item: urgent[0], more: urgent.length - 1 };

  if (!calculated) return { item: { kind: "calc" }, more: 0 };

  const stalled = cards.find(
    (c) => !isClosedDeadline(c.deadline) && c.progress.done > 0 && c.progress.done < c.progress.total
  );
  return { item: stalled ? { kind: "stalled", policy: stalled.policy, progress: stalled.progress } : null, more: 0 };
}

/** 오늘 할 일 카드에 오른 정책 id — 다가오는 일정에서 뺀다 */
export function todoPolicyId(item: TodoItem | null): string | null {
  return item && "policy" in item ? item.policy.id : null;
}

export type ScheduleEvent = { policy: PolicyMeta; kind: "start" | "end"; date: string; days: number };

/**
 * 다가오는 일정 — 관심 지원금의 신청 시작일 · 마감일 중 오늘 ~ 오늘+14일. 상시(마감일 없음)는 마감 일정이 없고,
 * 이미 지난 시작일은 일정이 아니다. 가까운 순, 같은 날이면 마감 먼저. 몇 줄 보일지는 화면이 정한다.
 */
export function upcomingSchedule(
  policies: PolicyMeta[],
  saved: readonly string[],
  todayISO: string,
  excludeId: string | null
): ScheduleEvent[] {
  const byId = new Map(policies.map((p) => [p.id, p]));
  const within = (iso: string) => {
    const days = daysBetween(todayISO, iso);
    return days >= 0 && days <= UPCOMING_DAYS ? days : null;
  };
  const events: ScheduleEvent[] = [];
  for (const id of saved) {
    const policy = byId.get(id);
    if (!policy || policy.id === excludeId) continue;
    const start = within(policy.applicationStart);
    if (start !== null) events.push({ policy, kind: "start", date: policy.applicationStart, days: start });
    if (policy.applicationEnd !== null) {
      const end = within(policy.applicationEnd);
      if (end !== null) events.push({ policy, kind: "end", date: policy.applicationEnd, days: end });
    }
  }
  return events.sort((a, b) => a.days - b.days || (a.kind === b.kind ? 0 : a.kind === "end" ? -1 : 1));
}
