import { describe, expect, it } from "vitest";
import { MAX_ENDPOINT_LENGTH, validatePushEndpoint, validatePushSubscription } from "../push-subscription";

const ok = { endpoint: "https://web.push.apple.com/QAbc", keys: { p256dh: "BPx_-9", auth: "aB-_" } };

describe("validatePushSubscription — 웹과 API 가 같은 규칙", () => {
  it("올바른 구독", () => {
    expect(validatePushSubscription(ok)).toEqual({ ok: true, value: ok });
  });

  it("https 가 아니거나 URL 이 아니면 거부", () => {
    expect(validatePushSubscription({ ...ok, endpoint: "http://push.example/a" }).ok).toBe(false);
    expect(validatePushSubscription({ ...ok, endpoint: "https://" }).ok).toBe(false);
  });

  it("주소 길이 상한", () => {
    const long = `https://push.example/${"a".repeat(MAX_ENDPOINT_LENGTH)}`;
    expect(validatePushSubscription({ ...ok, endpoint: long })).toEqual({ ok: false, error: "endpoint" });
  });

  it("키는 base64url, 길이 상한 (끝 = 는 두 개까지)", () => {
    expect(validatePushSubscription({ ...ok, keys: { p256dh: "a+b/", auth: "x" } })).toEqual({ ok: false, error: "keys.p256dh" });
    expect(validatePushSubscription({ ...ok, keys: { p256dh: "ab==", auth: "x".repeat(51) } })).toEqual({ ok: false, error: "keys.auth" });
    expect(validatePushSubscription({ ...ok, keys: { p256dh: "", auth: "x" } }).ok).toBe(false);
  });

  it("모르는 키는 어느 깊이에서든 거부 — 브라우저의 expirationTime 도 보내지 않는다", () => {
    expect(validatePushSubscription({ ...ok, expirationTime: null })).toEqual({ ok: false, error: "expirationTime" });
    expect(validatePushSubscription({ ...ok, keys: { ...ok.keys, extra: "1" } })).toEqual({ ok: false, error: "keys.extra" });
    expect(validatePushSubscription({ ...ok, userId: "someone" })).toEqual({ ok: false, error: "userId" });
  });

  it("객체가 아니면 거부", () => {
    expect(validatePushSubscription(null).ok).toBe(false);
    expect(validatePushSubscription([]).ok).toBe(false);
  });
});

describe("validatePushEndpoint — 끄기 본문", () => {
  it("endpoint 하나만", () => {
    expect(validatePushEndpoint({ endpoint: ok.endpoint })).toEqual({ ok: true, value: { endpoint: ok.endpoint } });
    expect(validatePushEndpoint({ endpoint: ok.endpoint, keys: ok.keys })).toEqual({ ok: false, error: "keys" });
    expect(validatePushEndpoint({}).ok).toBe(false);
  });
});
