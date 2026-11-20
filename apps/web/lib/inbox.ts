import type { ChecklistState } from "./user-data";
import { resolveAnswers } from "./age";
import { tagPolicy } from "./filter";
import { openPolicies, savedCards, type SavedCard } from "./home";
import type { DiscoveryAnswers, PolicyMeta } from "./types";

/**
 * 알림함 (상단바 종 → /notifications, 11/20).
 *
 * 서버에 쌓아 둔 알림을 읽는 게 아니라, 이 기기가 이미 가진 것(정책 목록 · 내 답 · 찜)으로 지금 알릴 일을
 * 그때그때 계산한다. 그래서 서버를 고치지 않아도 되고, 화면과 알림함이 어긋나지 않는다.
 * 폰 푸시(새 정책 알림 · 마감 알림)는 서버가 따로 보낸다 — 여기는 앱 안에서 모아 보는 자리다.
 *
 * 네 가지를 모은다. 한 정책은 한 번만 — 위에 있는 칸이 먼저 가져간다.
 *   1. 마감이 다가와요 — 찜한 지원금, 접수 중, 마감까지 7일 이하
 *   2. 곧 신청이 열려요 — 찜한 지원금, 신청 예정, 시작까지 14일 이하
 *   3. 새 지원금이 올라왔어요 — 처음 앱에 올라온 지(Supabase policies.published_at) 30일 이하이고 내 조건에 맞는 정책.
 *      휴대폰 새 정책 알림(apps/api/src/notifier/plan.ts matchPolicies)과 같은 판정 — 사는 곳을 답해야 하고, '해당 없음'은 뺀다.
 *      알림 기준선(11/16) 전부터 있던 정책은 올라온 날이 없어 여기 나오지 않는다 (11/20, docs/기획/2026-11-20-알림함-설계.md)
 *   4. 새로 신청이 열렸어요 — 내 조건으로 지금 신청할 수 있는 지원금(홈 '지금 신청할 수 있는'과 같은 목록) 중
 *      신청이 시작된 지 14일 이하
 */

export const DEADLINE_SOON_DAYS = 7;
export const UPCOMING_DAYS = 14;
export const RECENT_OPEN_DAYS = 14;
export const NEW_POLICY_DAYS = 30;

const DAY = 86_400_000;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / DAY);
}

/** ISO 시각의 서울 날짜(YYYY-MM-DD) */
export function seoulDateOf(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
}

export type InboxItem =
  | { kind: "deadline"; key: string; policy: PolicyMeta; days: number; card: SavedCard }
  | { kind: "upcoming"; key: string; policy: PolicyMeta; days: number; card: SavedCard }
  | { kind: "new"; key: string; policy: PolicyMeta; days: number; tag: "가능성 있음" | "확인 필요" }
  | { kind: "opened"; key: string; policy: PolicyMeta; days: number };

export function inboxItems(
  policies: PolicyMeta[],
  answers: DiscoveryAnswers,
  saved: readonly string[],
  todayISO: string,
  read: { checklist(id: string): ChecklistState; documents(id: string): string[] }
): InboxItem[] {
  const cards = savedCards(policies, saved, todayISO, read);
  const taken = new Set<string>();

  const deadline: InboxItem[] = [];
  const upcoming: InboxItem[] = [];
  for (const card of cards) {
    const { policy } = card;
    if (todayISO < policy.applicationStart) {
      const days = daysBetween(todayISO, policy.applicationStart);
      if (days <= UPCOMING_DAYS) upcoming.push({ kind: "upcoming", key: `upcoming:${policy.id}:${policy.applicationStart}`, policy, days, card });
    } else if (policy.applicationEnd !== null && todayISO <= policy.applicationEnd) {
      const days = daysBetween(todayISO, policy.applicationEnd);
      if (days <= DEADLINE_SOON_DAYS) deadline.push({ kind: "deadline", key: `deadline:${policy.id}:${policy.applicationEnd}`, policy, days, card });
    }
  }
  deadline.sort((a, b) => a.days - b.days);
  upcoming.sort((a, b) => a.days - b.days);
  for (const item of [...deadline, ...upcoming]) taken.add(item.policy.id);

  // 새 지원금 — 사는 곳을 답하지 않았으면 알리지 않는다(휴대폰 새 정책 알림과 같다, 11/08 결정)
  const added: InboxItem[] = [];
  if (answers.region) {
    const resolved = resolveAnswers(answers, todayISO);
    for (const policy of policies) {
      if (!policy.publishedAt || taken.has(policy.id)) continue;
      const days = daysBetween(seoulDateOf(policy.publishedAt), todayISO);
      if (days < 0 || days >= NEW_POLICY_DAYS) continue;
      if (policy.applicationEnd !== null && policy.applicationEnd < todayISO) continue;
      const { tag } = tagPolicy(policy, resolved);
      if (tag === "해당 없음") continue;
      added.push({ kind: "new", key: `new:${policy.id}:${policy.publishedAt}`, policy, days, tag });
    }
  }
  added.sort((a, b) => a.days - b.days);
  for (const item of added) taken.add(item.policy.id);

  const opened: InboxItem[] = [];
  for (const policy of openPolicies(policies, answers, todayISO) ?? []) {
    if (taken.has(policy.id)) continue;
    const days = daysBetween(policy.applicationStart, todayISO);
    if (days >= 0 && days <= RECENT_OPEN_DAYS) opened.push({ kind: "opened", key: `opened:${policy.id}:${policy.applicationStart}`, policy, days });
  }
  opened.sort((a, b) => a.days - b.days);

  return [...deadline, ...upcoming, ...added, ...opened];
}

// ── 읽음 표시 ──
// 이 기기에만 둔다(동기화하지 않는다). 다른 기기에서 다시 '새 소식'으로 보여도 잃는 것이 없다.

export const INBOX_SEEN_KEY = "perky.inbox.seen";
/** 알림함을 볼 때 쏘는 이벤트 — 상단바 종의 점이 바로 꺼지게 */
export const INBOX_SEEN_EVENT = "perky:inbox-seen";
const SEEN_MAX = 200;

export function loadInboxSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(INBOX_SEEN_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function hasUnseen(items: readonly InboxItem[], seen: ReadonlySet<string>): boolean {
  return items.some((item) => !seen.has(item.key));
}

/** 지금 보이는 알림을 모두 읽음으로. 오래된 것부터 버려 SEEN_MAX 개만 남긴다. */
export function markInboxSeen(items: readonly InboxItem[]): void {
  try {
    const seen = [...loadInboxSeen()];
    for (const item of items) if (!seen.includes(item.key)) seen.push(item.key);
    window.localStorage.setItem(INBOX_SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)));
    window.dispatchEvent(new Event(INBOX_SEEN_EVENT));
  } catch {
    // 저장이 막혀도(시크릿 모드 등) 알림함은 그대로 보인다 — 점만 남는다
  }
}
