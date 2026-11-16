import type { Validation } from "./user-data";

/**
 * 알림 구독 본문 — 웹(lib/push.ts · lib/remote.ts)과 API(apps/api)가 함께 쓰는 단독 출처
 * (docs/기획/2026-11-16-새-정책-알림-설계.md "API"). user-data.ts 처럼 타입 말고는 아무것도 import 하지 않고,
 * 브라우저 API 도 Node API 도 쓰지 않는다. 오류에는 경로만 담는다(값은 담지 않는다).
 */
export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const MAX_PUSH_BODY_BYTES = 4096;
export const MAX_ENDPOINT_LENGTH = 1000;

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function unknownKey(obj: Record<string, unknown>, allowed: readonly string[], prefix = ""): string | null {
  const extra = Object.keys(obj).find((k) => !allowed.includes(k));
  return extra === undefined ? null : `${prefix}${extra}`;
}

function isEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || !v.startsWith("https://") || v.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    return new URL(v).hostname !== "";
  } catch {
    return false;
  }
}

const isKey = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length >= 1 && v.length <= max && BASE64URL.test(v);

export function validatePushSubscription(input: unknown): Validation<PushSubscriptionBody> {
  if (!isPlainObject(input)) return { ok: false, error: "(root)" };
  const extra = unknownKey(input, ["endpoint", "keys"]);
  if (extra) return { ok: false, error: extra };
  if (!isEndpoint(input.endpoint)) return { ok: false, error: "endpoint" };
  const keys = input.keys;
  if (!isPlainObject(keys)) return { ok: false, error: "keys" };
  const extraKey = unknownKey(keys, ["p256dh", "auth"], "keys.");
  if (extraKey) return { ok: false, error: extraKey };
  if (!isKey(keys.p256dh, 200)) return { ok: false, error: "keys.p256dh" };
  if (!isKey(keys.auth, 50)) return { ok: false, error: "keys.auth" };
  return { ok: true, value: { endpoint: input.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } };
}

export function validatePushEndpoint(input: unknown): Validation<{ endpoint: string }> {
  if (!isPlainObject(input)) return { ok: false, error: "(root)" };
  const extra = unknownKey(input, ["endpoint"]);
  if (extra) return { ok: false, error: extra };
  if (!isEndpoint(input.endpoint)) return { ok: false, error: "endpoint" };
  return { ok: true, value: { endpoint: input.endpoint } };
}
