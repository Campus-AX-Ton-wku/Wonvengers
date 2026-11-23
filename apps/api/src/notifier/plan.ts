import { resolveAnswers } from "../../../web/lib/age";
import { tagPolicy } from "../../../web/lib/filter";
import { NOTICE_REGION, noticeStatus, type HousingNotice } from "../../../web/lib/notices";
import { policyAppliesToRegion } from "../../../web/lib/region";
import type { DiscoveryAnswers, PolicyMeta } from "../../../web/lib/types";

/**
 * 새 정책 알림의 판단 (docs/기획/2026-11-16-새-정책-알림-설계.md "알림 Lambda").
 * 네트워크 · 저장소 없이 값만 다룬다 — run.ts 가 부르고 test/notifier-plan.test.ts 가 검사한다.
 * 판정은 앱과 같은 코드(tagPolicy)라 화면과 알림이 어긋나지 않는다.
 */

/** 보내는 시간: 서울 9시대 ~ 21시대 */
export const SEND_HOURS = { first: 9, last: 21 } as const;

/** 서울(UTC+9, 서머타임 없음)의 날짜(YYYY-MM-DD)와 시 */
export function kst(now: Date): { date: string; hour: number } {
  const shifted = new Date(now.getTime() + 9 * 3600_000);
  return { date: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

export function isSendingHour(now: Date): boolean {
  const { hour } = kst(now);
  return hour >= SEND_HOURS.first && hour <= SEND_HOURS.last;
}

/**
 * 이미 알린 목록에 없는 정책. 마감된 것(applicationEnd < 오늘)은 보내지 않지만 toMark 에는 넣는다 —
 * 그래야 다음 회차에 다시 '새 정책'으로 잡히지 않는다.
 */
export function selectNewPolicies(
  published: PolicyMeta[],
  announced: ReadonlySet<string>,
  today: string
): { toSend: PolicyMeta[]; toMark: string[] } {
  const fresh = published.filter((p) => !announced.has(p.id));
  return {
    toSend: fresh.filter((p) => p.applicationEnd === null || p.applicationEnd >= today),
    toMark: fresh.map((p) => p.id),
  };
}

export type MatchTag = "가능성 있음" | "확인 필요";
export interface Match {
  policy: PolicyMeta;
  tag: MatchTag;
}

/**
 * 저장된 답으로 1층 판정. 지역을 답하지 않았으면 null — 알리지 않는다(11/08 결정).
 * '해당 없음'은 빼고, '가능성 있음'을 앞에 둔다(같은 등급은 들어온 순서).
 */
export function matchPolicies(answers: DiscoveryAnswers, policies: PolicyMeta[], today: string): Match[] | null {
  if (!answers.region) return null;
  const resolved = resolveAnswers(answers, today);
  const matches: Match[] = [];
  for (const policy of policies) {
    const { tag } = tagPolicy(policy, resolved);
    if (tag === "가능성 있음" || tag === "확인 필요") matches.push({ policy, tag });
  }
  return [...matches.filter((m) => m.tag === "가능성 있음"), ...matches.filter((m) => m.tag === "확인 필요")];
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const TAG = "new-policy";

/** 잠금 화면에 보이므로 정책 이름만 — 소득 · 나이 같은 답은 넣지 않는다. */
export function composeMessage(matches: Match[]): PushMessage {
  if (matches.length === 0) throw new Error("composeMessage: no matches");
  const [first] = matches;
  if (matches.length === 1) {
    return {
      title: "새 지원금이 올라왔어요",
      body:
        first.tag === "가능성 있음"
          ? `${first.policy.name} — 조건에 맞을 가능성이 있어요`
          : `${first.policy.name} — 받을 수도 있는 지원금이에요. 조건을 확인해 보세요`,
      url: `/find/policies/${first.policy.id}`,
      tag: TAG,
    };
  }
  return {
    title: `새 지원금 ${matches.length}건이 올라왔어요`,
    body: `${first.policy.name} 외 ${matches.length - 1}건 — 받을 수 있을지 확인해 보세요`,
    url: "/find/policies",
    tag: TAG,
  };
}

// ── 마감 알림 (11/20, docs/기획/2026-11-20-마감-알림-설계.md) ──

/** 찜한 지원금 마감까지 남은 날이 이 중 하나인 날에 알린다 — 7일 전 · 1일 전(내일 마감). */
export const REMINDER_DAYS: readonly number[] = [7, 1];
/** 하루 한 번, 서울 10시 회차에 보낸다 (매시 도는 Lambda 중 한 번). */
export const REMINDER_HOUR = 10;

const DAY_MS = 86_400_000;

export interface Reminder {
  policy: PolicyMeta;
  days: number;
}

/**
 * 찜한 지원금 중 오늘 알릴 것. 공개 목록에 있고, 접수가 시작됐고, 마감일이 있고, 남은 날이 REMINDER_DAYS 에 든 것.
 * 남은 날이 적은 것이 앞, 같으면 찜한 순서(최근 것이 앞).
 */
export function deadlineReminders(saved: readonly string[], published: PolicyMeta[], today: string): Reminder[] {
  const byId = new Map(published.map((p) => [p.id, p]));
  const out: Reminder[] = [];
  for (const id of saved) {
    const policy = byId.get(id);
    if (!policy || policy.applicationEnd === null || today < policy.applicationStart || today > policy.applicationEnd) continue;
    const days = Math.round((Date.parse(policy.applicationEnd) - Date.parse(today)) / DAY_MS);
    if (REMINDER_DAYS.includes(days)) out.push({ policy, days });
  }
  return out.sort((a, b) => a.days - b.days);
}

const REMINDER_TAG = "deadline";

/** 잠금 화면에 보이므로 정책 이름과 남은 날만. 한 건이면 그 준비 화면, 여러 건이면 관심 탭으로. */
export function composeReminder(reminders: Reminder[]): PushMessage {
  if (reminders.length === 0) throw new Error("composeReminder: no reminders");
  const [first] = reminders;
  const left = (days: number) => (days === 1 ? "내일 마감이에요" : `마감까지 ${days}일 남았어요`);
  if (reminders.length === 1) {
    return {
      title: "관심 지원금 마감이 다가와요",
      body: `${first.policy.name} — ${left(first.days)}. 신청 준비를 확인해 보세요`,
      url: `/find/policies/${first.policy.id}/prepare`,
      tag: REMINDER_TAG,
    };
  }
  return {
    title: `관심 지원금 ${reminders.length}건 마감이 다가와요`,
    body: `${first.policy.name} 외 ${reminders.length - 1}건 — 신청 준비를 확인해 보세요`,
    url: "/saved",
    tag: REMINDER_TAG,
  };
}

// ── 새 청약 공고 (11/22, docs/기획/2026-11-22-청약-공고-설계.md §3) ──

export function selectNewNotices(published: HousingNotice[], announced: ReadonlySet<string>, today: string) {
  const fresh = published.filter((n) => !announced.has(n.id));
  return { toSend: fresh.filter((n) => noticeStatus(n, today) !== "ended"), toMark: fresh.map((n) => n.id) };
}

/** 사는 곳이 익산(답한 것)일 때만 — 알림함과 같은 규칙 */
export function livesInNoticeRegion(answers: DiscoveryAnswers): boolean {
  return Boolean(answers.region) && policyAppliesToRegion(NOTICE_REGION, answers.region as string);
}

/** 잠금 화면에 보이므로 공고명만 */
export function composeNoticeMessage(notices: HousingNotice[]): PushMessage {
  if (notices.length === 0) throw new Error("composeNoticeMessage: no notices");
  const [first] = notices;
  return {
    title: "익산에 새 청약 공고가 올라왔어요",
    body: notices.length === 1 ? first.title : `${first.title} 외 ${notices.length - 1}건`,
    url: "/housing",
    tag: "notice",
  };
}
