import { hasConsent, storedSub } from "./auth";
import { isPushConfigured, pushOwner, pushState, pushSupport } from "./push";
import { loadPushAsk, savePushAsk } from "./storage";

/**
 * 알림 허용을 먼저 묻는 때 (11/23 ggue).
 *
 * - 홈: 카카오 로그인하고 처음 들어오면 묻는다. [나중에]면 7일마다 다시 — 알림을 켤 때까지.
 * - 알림함(오른쪽 위 종): 처음 들어갔을 때 한 번 묻는다. 홈에서 막 물었어도 묻는다(ggue).
 * - 아이폰 Safari 처럼 홈 화면에 추가하지 않은 곳은 알림을 켤 수 없다 — 대신 '홈 화면에 추가' 안내를 같은 때에 띄운다.
 *
 * 묻지 않는 때: 알림을 쓸 수 없는 빌드 · 로그인 안 함 · 저장 동의 전(알림 설정 화면과 같은 조건) · 이 브라우저가 알림을 못 씀 ·
 * 기기 설정에서 이미 거부(다시 물을 수 없다) · 이미 켜져 있음.
 */
export type PushAskPlace = "home" | "inbox";
export type PushAskKind = "ask" | "home-screen";

export const PUSH_ASK_INTERVAL_DAYS = 7;
const INTERVAL_MS = PUSH_ASK_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

export async function pushAskFor(place: PushAskPlace, now: Date = new Date()): Promise<PushAskKind | null> {
  if (!isPushConfigured()) return null;
  const sub = storedSub();
  if (!sub || !hasConsent(sub)) return null;

  const support = pushSupport();
  if (support === "unsupported") return null;
  if (support === "ready") {
    if (Notification.permission === "denied") return null;
    const state = await pushState().catch(() => "off" as const);
    // 다른 계정이 올린 구독이면 이 사람에게는 꺼진 것과 같다 (PushSettings 와 같은 판단)
    if (state === "denied" || (state === "on" && pushOwner() === sub)) return null;
  }

  const record = loadPushAsk(sub);
  const due =
    (place === "inbox" && !record.inboxAsked) ||
    record.lastAskedAt === null ||
    now.getTime() - Date.parse(record.lastAskedAt) >= INTERVAL_MS;
  if (!due) return null;
  return support === "needs-home-screen" ? "home-screen" : "ask";
}

/** 창을 띄운 순간 적는다 — 7일은 여기서부터 센다 */
export function markPushAsked(place: PushAskPlace, now: Date = new Date()): void {
  const sub = storedSub();
  if (!sub) return;
  const record = loadPushAsk(sub);
  savePushAsk(sub, {
    lastAskedAt: now.toISOString(),
    inboxAsked: record.inboxAsked || place === "inbox",
  });
}
