import type { Icon3DName } from "./icons3d";
import { BADGE_IDS, type BadgeId } from "./user-data";

/**
 * 배지 8개 — 판정은 순수 함수 (docs/기획/2026-11-22-내-프로필-설계.md §7).
 * 앱을 쓰다 보면 저절로 모인다. 금액으로 받는 배지는 없다(실제로 받았는지 앱이 모른다) · 친구 · 순위 비교 없음.
 * 재료(BadgeFacts)는 lib/badge-facts.ts 가 이 기기 기록에서 모은다. 받은 날은 lib/storage.ts loadBadges · saveBadges(계정 동기화).
 */

export interface BadgeFacts {
  /** 계산 결과가 저장돼 있다(계약 조건 + 자격 답) */
  calculated: boolean;
  /** 관심 지원금 수 */
  saved: number;
  /** 어느 지원금이든 신청 준비 체크를 하나라도 했다 */
  prepStarted: boolean;
  /** 신청 준비를 가장 많이 한 지원금의 진행 */
  prepBest: { done: number; total: number } | null;
  /** 끝 장까지 연 주거 가이드 수 / 전체 */
  guidesRead: number;
  guidesTotal: number;
  /** 주거비 달력에 체크한 칸이 하나라도 있다 */
  ledgerAny: boolean;
  /** '그 달 칸을 다 체크한 달'이 가장 길게 이어진 수 */
  ledgerStreak: number;
}

export interface Badge {
  id: BadgeId;
  label: string;
  /** 받았을 때 한 줄 — "신청 준비를 처음 시작했어요" */
  desc: string;
  /** 다음 배지로 안내할 때 — "관심 지원금에서 신청 준비를 시작해요" */
  howTo: string;
  icon: Icon3DName;
}

export const BADGES: readonly Badge[] = [
  { id: "first_calc", label: "첫 계산", desc: "내 월세를 처음 계산했어요.", howTo: "실제로 낼 돈을 계산해 봐요.", icon: "calculator" },
  { id: "first_save", label: "첫 관심", desc: "관심 지원금을 처음 담았어요.", howTo: "마음에 드는 지원금에 하트를 눌러요.", icon: "housing-benefit" },
  { id: "save_5", label: "관심 5개", desc: "관심 지원금 5개를 모았어요.", howTo: "관심 지원금을 5개 모아요.", icon: "wallet" },
  { id: "prep_start", label: "준비 시작", desc: "신청 준비를 처음 시작했어요.", howTo: "관심 지원금에서 신청 준비를 시작해요.", icon: "contract" },
  { id: "prep_done", label: "준비 끝", desc: "한 지원금의 신청 준비를 다 마쳤어요.", howTo: "서류를 하나씩 챙겨 신청 준비를 마쳐요.", icon: "receipt" },
  { id: "guide_read", label: "가이드 정독", desc: "주거 가이드 3편을 끝까지 읽었어요.", howTo: "주거 가이드를 끝 장까지 읽어요.", icon: "guarantee" },
  { id: "ledger_first", label: "달력 첫 기록", desc: "주거비 달력에 처음 적었어요.", howTo: "달력에서 낸 돈을 체크해요.", icon: "rent" },
  { id: "ledger_3months", label: "3달 꼬박", desc: "달력 3달을 빠짐없이 적었어요.", howTo: "달력을 3달 연속 다 적어요.", icon: "move-in" },
];

export function badgeOf(id: BadgeId): Badge {
  return BADGES.find((b) => b.id === id) ?? BADGES[0];
}

export interface BadgeStatus {
  id: BadgeId;
  /** 지금 기록으로 조건을 채웠는가 */
  met: boolean;
  /** 진행 표시가 있는 배지(관심 5개 · 준비 끝 · 가이드 정독 · 3달 꼬박)만 — 목표를 넘지 않는다 */
  progress: { done: number; total: number } | null;
}

const capped = (done: number, total: number) => ({ done: Math.min(done, total), total });

export function badgeStatuses(f: BadgeFacts): BadgeStatus[] {
  const prepDone = f.prepBest !== null && f.prepBest.total > 0 && f.prepBest.done >= f.prepBest.total;
  const byId: Record<BadgeId, Omit<BadgeStatus, "id">> = {
    first_calc: { met: f.calculated, progress: null },
    first_save: { met: f.saved >= 1, progress: null },
    save_5: { met: f.saved >= 5, progress: capped(f.saved, 5) },
    prep_start: { met: f.prepStarted, progress: null },
    prep_done: { met: prepDone, progress: f.prepBest ? capped(f.prepBest.done, f.prepBest.total) : null },
    guide_read: { met: f.guidesTotal > 0 && f.guidesRead >= f.guidesTotal, progress: capped(f.guidesRead, f.guidesTotal) },
    ledger_first: { met: f.ledgerAny, progress: null },
    ledger_3months: { met: f.ledgerStreak >= 3, progress: capped(f.ledgerStreak, 3) },
  };
  return BADGE_IDS.map((id) => ({ id, ...byId[id] }));
}

/** 조건을 채웠고 아직 안 받은 배지 — 정해진 순서로. 한 번 받은 배지는 조건이 사라져도 남는다 */
export function newBadges(statuses: readonly BadgeStatus[], earned: Partial<Record<BadgeId, string>>): BadgeId[] {
  return statuses.filter((s) => s.met && !earned[s.id]).map((s) => s.id);
}

/** 다음에 노릴 배지 — 안 받았고 조건도 아직인 첫 배지. 다 받았으면 null */
export function nextBadge(statuses: readonly BadgeStatus[], earned: Partial<Record<BadgeId, string>>): Badge | null {
  const next = statuses.find((s) => !s.met && !earned[s.id]);
  return next ? badgeOf(next.id) : null;
}
