import { describe, expect, it, vi } from "vitest";
import { MESSAGE_TTL_SECONDS, createSender } from "../src/notifier/sender";
import type { StoredDevice } from "../src/push-store";

const device: StoredDevice = {
  userId: "u1",
  deviceId: "d1",
  endpoint: "https://push.example/1",
  keys: { p256dh: "p", auth: "a" },
  updatedAt: "2026-11-16T00:00:00.000Z",
};
const message = { title: "t", body: "b", url: "/find/policies", tag: "new-policy" };
const vapid = { subject: "https://wonvengers.vercel.app", publicKey: "PUB", privateKey: "PRIV" };

describe("createSender — web-push 감싸기", () => {
  it("구독 · JSON 본문 · TTL 12시간 · VAPID 로 보낸다", async () => {
    const lib = { sendNotification: vi.fn(async () => ({})) };
    expect(await createSender(lib, vapid)(device, message)).toBe("sent");
    expect(lib.sendNotification).toHaveBeenCalledWith(
      { endpoint: device.endpoint, keys: device.keys },
      JSON.stringify(message),
      { TTL: MESSAGE_TTL_SECONDS, vapidDetails: vapid }
    );
    expect(MESSAGE_TTL_SECONDS).toBe(43200);
  });

  it("404 · 410 은 끊긴 구독(gone), 그 밖의 오류는 failed — 던지지 않는다", async () => {
    const fail = (statusCode?: number) => ({
      sendNotification: vi.fn(async () => {
        throw Object.assign(new Error("x"), statusCode ? { statusCode } : {});
      }),
    });
    expect(await createSender(fail(410), vapid)(device, message)).toBe("gone");
    expect(await createSender(fail(404), vapid)(device, message)).toBe("gone");
    expect(await createSender(fail(500), vapid)(device, message)).toBe("failed");
    expect(await createSender(fail(), vapid)(device, message)).toBe("failed");
  });
});
