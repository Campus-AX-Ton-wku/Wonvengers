import { resolveAnswers } from "../../../web/lib/age";
import { tagPolicy } from "../../../web/lib/filter";
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
