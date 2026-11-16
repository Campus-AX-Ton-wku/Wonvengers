import type { PolicyMeta } from "../../../web/lib/types";
import type { PushStore, StoredDevice } from "../push-store";
import type { UserDataStore } from "../store";
import { composeMessage, isSendingHour, kst, matchPolicies, selectNewPolicies } from "./plan";
import type { Sender } from "./sender";

/** 한 회차 (docs/기획/2026-11-16-새-정책-알림-설계.md "알림 Lambda" 1~9). 저장소 · 네트워크는 deps 로 받는다. */
export interface NotifierDeps {
  push: Pick<PushStore, "listDevices" | "deleteDevice" | "getAnnounced" | "saveAnnounced">;
  users: Pick<UserDataStore, "get">;
  fetchPolicies(): Promise<PolicyMeta[]>;
  send: Sender;
  now(): Date;
}

export interface RunSummary {
  outcome: "skipped-hours" | "fetch-failed" | "initialized" | "no-new" | "sent";
  newPolicies: number;
  recipients: number;
  devicesSent: number;
  devicesFailed: number;
  devicesRemoved: number;
  /** 실패한 발송을 원인(상태 코드 · 오류 이름)별로 센 것 */
  failures: Record<string, number>;
  /** 목록을 못 읽었을 때만 — 오류 이름과 메시지 앞 120자(목록 주소는 공개라 사용자 정보가 없다) */
  fetchError?: string;
}

function countFailure(summary: RunSummary, reason: string): void {
  summary.failures[reason] = (summary.failures[reason] ?? 0) + 1;
}

export async function runNotifier(deps: NotifierDeps, { force = false }: { force?: boolean } = {}): Promise<RunSummary> {
  const now = deps.now();
  const summary: RunSummary = {
    outcome: "no-new",
    newPolicies: 0,
    recipients: 0,
    devicesSent: 0,
    devicesFailed: 0,
    devicesRemoved: 0,
    failures: {},
  };
  if (!force && !isSendingHour(now)) return { ...summary, outcome: "skipped-hours" };

  let published: PolicyMeta[];
  try {
    published = await deps.fetchPolicies();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return { ...summary, outcome: "fetch-failed", fetchError: `${e.name}: ${e.message.slice(0, 120)}` };
  }

  const announced = await deps.push.getAnnounced();
  if (announced === null) {
    // 첫 실행: 지금 있는 정책을 한꺼번에 알리지 않는다
    await deps.push.saveAnnounced(new Set(published.map((p) => p.id)), now);
    return { ...summary, outcome: "initialized" };
  }

  const today = kst(now).date;
  const { toSend, toMark } = selectNewPolicies(published, announced, today);
  if (toMark.length === 0) return summary;
  summary.newPolicies = toSend.length;

  if (toSend.length > 0) {
    const byUser = new Map<string, StoredDevice[]>();
    for (const d of await deps.push.listDevices()) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);

    for (const [userId, devices] of byUser) {
      try {
        const item = await deps.users.get(userId);
        if (!item || !item.data.consentVersion) continue;
        const matches = matchPolicies(item.data.answers.values, toSend, today);
        if (!matches || matches.length === 0) continue;
        summary.recipients += 1;
        const message = composeMessage(matches);
        for (const device of devices) {
          const { outcome, reason } = await deps.send(device, message);
          if (outcome === "sent") summary.devicesSent += 1;
          else if (outcome === "gone") {
            await deps.push.deleteDevice(userId, device.deviceId);
            summary.devicesRemoved += 1;
          } else {
            summary.devicesFailed += 1;
            countFailure(summary, reason ?? "unknown");
          }
        }
      } catch (err) {
        // 이 사용자만 건너뛴다 — 나머지 사용자에게는 보낸다
        summary.devicesFailed += devices.length;
        const name = err instanceof Error ? err.name : "unknown";
        summary.failures[name] = (summary.failures[name] ?? 0) + devices.length;
      }
    }
  }

  // 보낸 '뒤에' 적는다 — 그 사이에 멈추면 다음 회차에 다시 보낸다(빠지는 것보다 낫다)
  await deps.push.saveAnnounced(new Set([...announced, ...toMark]), now);
  return { ...summary, outcome: toSend.length > 0 ? "sent" : "no-new" };
}
