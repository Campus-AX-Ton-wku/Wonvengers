// apps/web/lib/push.ts
import { authConfig, storedSub } from "./auth";
import type { PushSubscriptionBody } from "./push-subscription";
import { deletePushRemote, putPushRemote } from "./remote";

/**
 * 이 기기의 알림 구독 (docs/기획/2026-11-16-새-정책-알림-설계.md "lib/push.ts").
 * 부르는 쪽: 내 계정 화면(app/account/PushSettings.tsx), 로그아웃 · 탈퇴(lib/sync.ts).
 */
export const SW_PATH = "/sw.js";

/** Next 는 process.env.NEXT_PUBLIC_* 를 빌드 때 글자 그대로 바꿔 넣는다 — 이 줄의 모양을 바꾸지 말 것. */
export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

/** 알림 칸을 그릴지 — 로그인을 쓸 수 있고 공개 키가 있을 때만 */
export function isPushConfigured(): boolean {
  return authConfig() !== null && vapidPublicKey() !== null;
}

export type PushSupport = "unsupported" | "needs-home-screen" | "ready";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isIos(nav: Navigator): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

function isStandalone(win: Window): boolean {
  return win.matchMedia?.("(display-mode: standalone)").matches === true || (win.navigator as NavigatorWithStandalone).standalone === true;
}

/** 아이폰은 홈 화면에 추가한 앱(iOS 16.4+)에서만 웹 푸시를 받는다. */
export function pushSupport(win: Window = window): PushSupport {
  const nav = win.navigator;
  if (isIos(nav) && !isStandalone(win)) return "needs-home-screen";
  const capable = "serviceWorker" in nav && "PushManager" in win && "Notification" in win;
  return capable ? "ready" : "unsupported";
}

export type PushState = "on" | "off" | "denied";

const OWNER_KEY = "perky.push-owner";

/** 이 기기의 알림 구독을 서버에 올린 계정(sub). 다른 계정이 로그인해 있으면 이 구독은 그 사람 것이 아니다. */
export function pushOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setPushOwner(sub: string | null): void {
  try {
    if (sub) window.localStorage.setItem(OWNER_KEY, sub);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // 저장소를 못 쓰면 소유자 확인만 못 한다
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** 서버에 보낼 모양 — endpoint 와 keys 만(expirationTime 은 서버가 거부한다). */
function toBody(sub: PushSubscription): PushSubscriptionBody {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("push subscription has no keys");
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

function base64UrlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * [알림 켜기]. 버튼 클릭 안에서 부른다 — 아이폰은 사용자 동작 직후에만 권한을 물을 수 있어서
 * 권한 요청을 맨 먼저 한다(워커 등록보다 앞).
 */
export async function enablePush(): Promise<PushState> {
  const key = vapidPublicKey();
  if (!key) throw new Error("push is not configured");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) }));
  try {
    await putPushRemote(toBody(sub));
  } catch (err) {
    // 서버가 모르는 구독을 남기지 않는다 — '켜짐'인데 알림이 안 오는 일을 막는다
    await sub.unsubscribe().catch(() => false);
    throw err;
  }
  setPushOwner(storedSub());
  return "on";
}

/**
 * [알림 끄기]. 기기 구독을 먼저 끊는다 — 로그아웃이 제한 시간 뒤 떠나도 이 기기에는 더 오지 않는다.
 * 서버 행이 남으면 다음 발송의 410 으로 지워진다.
 */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  setPushOwner(null);
  await deletePushRemote(endpoint).catch(() => undefined);
}

/** 계정 화면을 열 때 — 구독 중이면 서버에 다시 알려 보관 기간을 늘린다. 실패해도 조용히. */
export async function refreshPush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await putPushRemote(toBody(sub)).catch(() => undefined);
}

/** 로그아웃 — 최대 timeoutMs 만 기다리고 무엇이 실패해도 던지지 않는다. */
export async function disablePushQuietly(timeoutMs = 3000): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    disablePush().catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

/** 탈퇴 — 서버는 이미 그 사용자의 구독을 모두 지웠다. 이 기기 구독만 끊는다. */
export async function unsubscribeThisDevice(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  await sub?.unsubscribe().catch(() => false);
  setPushOwner(null);
}
