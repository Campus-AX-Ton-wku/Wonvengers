import type { StoredDevice } from "../push-store";
import type { PushMessage } from "./plan";

export type SendOutcome = "sent" | "gone" | "failed";
/** reason 은 실패 원인을 세는 용도 — 상태 코드 아니면 오류 이름만. 메시지 · 구독 주소는 담지 않는다. */
export interface SendResult {
  outcome: SendOutcome;
  reason?: string;
}
export type Sender = (device: StoredDevice, message: PushMessage) => Promise<SendResult>;

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
    options: { TTL: number; timeout: number; vapidDetails: VapidDetails }
  ): Promise<unknown>;
}

/** 꺼진 기기에 12시간 안에 닿지 못하면 버린다 — 다음 날 아침 '새 지원금'은 이미 늦다. */
export const MESSAGE_TTL_SECONDS = 12 * 60 * 60;

/** 푸시 서비스 하나가 느려도 회차 전체가 Lambda 60초를 넘지 않게 한다. */
export const SEND_TIMEOUT_MS = 10_000;

export function createSender(lib: WebPushLike, vapid: VapidDetails): Sender {
  return async (device, message) => {
    try {
      await lib.sendNotification({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify(message), {
        TTL: MESSAGE_TTL_SECONDS,
        timeout: SEND_TIMEOUT_MS,
        vapidDetails: vapid,
      });
      return { outcome: "sent" };
    } catch (err) {
      const status = (err as { statusCode?: unknown }).statusCode;
      if (status === 404 || status === 410) return { outcome: "gone" };
      const reason = typeof status === "number" ? String(status) : err instanceof Error ? err.name : "unknown";
      return { outcome: "failed", reason };
    }
  };
}
