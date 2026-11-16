import type { StoredDevice } from "../push-store";
import type { PushMessage } from "./plan";

export type SendOutcome = "sent" | "gone" | "failed";
export type Sender = (device: StoredDevice, message: PushMessage) => Promise<SendOutcome>;

export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** web-push 의 쓰는 부분만 — 테스트에서 가짜로 바꾼다. */
export interface WebPushLike {
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; vapidDetails: VapidDetails }
  ): Promise<unknown>;
}

/** 꺼진 기기에 12시간 안에 닿지 못하면 버린다 — 다음 날 아침 '새 지원금'은 이미 늦다. */
export const MESSAGE_TTL_SECONDS = 12 * 60 * 60;

export function createSender(lib: WebPushLike, vapid: VapidDetails): Sender {
  return async (device, message) => {
    try {
      await lib.sendNotification({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify(message), {
        TTL: MESSAGE_TTL_SECONDS,
        vapidDetails: vapid,
      });
      return "sent";
    } catch (err) {
      const status = (err as { statusCode?: unknown }).statusCode;
      return status === 404 || status === 410 ? "gone" : "failed";
    }
  };
}
