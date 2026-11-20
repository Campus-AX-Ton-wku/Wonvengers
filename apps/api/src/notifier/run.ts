import type { PolicyMeta } from "../../../web/lib/types";
import type { PushStore, StoredDevice } from "../push-store";
import type { UserDataStore } from "../store";
import {
  composeMessage,
  composeReminder,
  deadlineReminders,
  isSendingHour,
  kst,
  matchPolicies,
  REMINDER_HOUR,
  selectNewPolicies,
  type PushMessage,
} from "./plan";
import type { Sender } from "./sender";

/** 한 회차 (docs/기획/2026-11-16-새-정책-알림-설계.md "알림 Lambda" 1~9). 저장소 · 네트워크는 deps 로 받는다. */
export interface NotifierDeps {
  push: Pick<
    PushStore,
    "listDevices" | "deleteDevice" | "getAnnounced" | "saveAnnounced" | "getReminderDate" | "saveReminderDate"
  >;
  users: Pick<UserDataStore, "get">;
  fetchPolicies(): Promise<PolicyMeta[]>;
  send: Sender;
  now(): Date;
}

export interface ReminderSummary {
  /** not-hour: 10시 회차가 아님 · done-today: 오늘 이미 돌림 · none: 알릴 찜 없음 · sent: 보냄 */
  outcome: "not-hour" | "done-today" | "none" | "sent";
  recipients: number;
}

export interface RunSummary {
  outcome: "skipped-hours" | "fetch-failed" | "initialized" | "no-new" | "sent";
  newPolicies: number;
  recipients: number;
  /** 기기 수는 새 정책 알림 · 마감 알림을 합친 것 */
  devicesSent: number;
  devicesFailed: number;
  devicesRemoved: number;
  /** 실패한 발송을 원인(상태 코드 · 오류 이름)별로 센 것 */
  failures: Record<string, number>;
  /** 목록을 못 읽었을 때만 — 오류 이름과 메시지 앞 120자(목록 주소는 공개라 사용자 정보가 없다) */
  fetchError?: string;
  /** 찜한 지원금 마감 알림 (11/20) — 목록을 읽은 회차에만 */
  reminders?: ReminderSummary;
}

function countFailure(summary: RunSummary, reason: string): void {
  summary.failures[reason] = (summary.failures[reason] ?? 0) + 1;
}

/** 구독 목록은 한 회차에 한 번만 읽는다 — 새 정책 알림과 마감 알림이 같이 쓴다. */
function deviceDirectory(deps: NotifierDeps) {
  let cache: Map<string, StoredDevice[]> | null = null;
  return {
    async byUser(): Promise<Map<string, StoredDevice[]>> {
      if (cache) return cache;
      cache = new Map();
      for (const d of await deps.push.listDevices()) cache.set(d.userId, [...(cache.get(d.userId) ?? []), d]);
      return cache;
    },
    /** 끊긴 구독은 같은 회차의 다음 발송에서 빼고 저장소에서도 지운다 */
    async forget(userId: string, deviceId: string): Promise<void> {
      await deps.push.deleteDevice(userId, deviceId);
      const list = cache?.get(userId);
      if (list) cache!.set(userId, list.filter((d) => d.deviceId !== deviceId));
    },
  };
}

type Directory = ReturnType<typeof deviceDirectory>;

/** 한 사람의 기기마다 한 통. 결과를 summary 에 더한다. */
async function deliver(
  deps: NotifierDeps,
  directory: Directory,
  summary: RunSummary,
  userId: string,
  devices: StoredDevice[],
  message: PushMessage
): Promise<void> {
  for (const device of devices) {
    const { outcome, reason } = await deps.send(device, message);
    if (outcome === "sent") summary.devicesSent += 1;
    else if (outcome === "gone") {
      await directory.forget(userId, device.deviceId);
      summary.devicesRemoved += 1;
    } else {
      summary.devicesFailed += 1;
      countFailure(summary, reason ?? "unknown");
    }
  }
}

/** 사용자 하나에서 난 오류는 그 사람만 건너뛴다 — 나머지에게는 보낸다 */
function skipUser(summary: RunSummary, devices: StoredDevice[], err: unknown): void {
  summary.devicesFailed += devices.length;
  const name = err instanceof Error ? err.name : "unknown";
  summary.failures[name] = (summary.failures[name] ?? 0) + devices.length;
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

  const directory = deviceDirectory(deps);
  summary.outcome = await announceNewPolicies(deps, directory, summary, published, now);
  summary.reminders = await remindDeadlines(deps, directory, summary, published, now, force);
  return summary;
}

/** 새 정책 알림 (설계 "알림 Lambda" 4~9). 회차의 outcome 을 돌려준다. */
async function announceNewPolicies(
  deps: NotifierDeps,
  directory: Directory,
  summary: RunSummary,
  published: PolicyMeta[],
  now: Date
): Promise<RunSummary["outcome"]> {
  const announced = await deps.push.getAnnounced();
  if (announced === null) {
    // 첫 실행: 지금 있는 정책을 한꺼번에 알리지 않는다
    await deps.push.saveAnnounced(new Set(published.map((p) => p.id)), now);
    return "initialized";
  }

  const today = kst(now).date;
  const { toSend, toMark } = selectNewPolicies(published, announced, today);
  if (toMark.length === 0) return "no-new";
  summary.newPolicies = toSend.length;

  if (toSend.length > 0) {
    for (const [userId, devices] of await directory.byUser()) {
      try {
        const item = await deps.users.get(userId);
        if (!item || !item.data.consentVersion) continue;
        const matches = matchPolicies(item.data.answers.values, toSend, today);
        if (!matches || matches.length === 0) continue;
        summary.recipients += 1;
        await deliver(deps, directory, summary, userId, devices, composeMessage(matches));
      } catch (err) {
        skipUser(summary, devices, err);
      }
    }
  }

  // 보낸 '뒤에' 적는다 — 그 사이에 멈추면 다음 회차에 다시 보낸다(빠지는 것보다 낫다)
  await deps.push.saveAnnounced(new Set([...announced, ...toMark]), now);
  return toSend.length > 0 ? "sent" : "no-new";
}

/**
 * 찜한 지원금 마감 알림 (11/20). 하루 한 번 — 서울 10시 회차에, 오늘 아직 안 돌렸으면.
 * force(시연 · 손으로 실행)면 시각 · '오늘 돌림'을 보지 않고 보낸다.
 * 날짜는 보낸 '뒤에' 적는다 — 새 정책 알림과 같은 이유.
 */
async function remindDeadlines(
  deps: NotifierDeps,
  directory: Directory,
  summary: RunSummary,
  published: PolicyMeta[],
  now: Date,
  force: boolean
): Promise<ReminderSummary> {
  const { date: today, hour } = kst(now);
  const result: ReminderSummary = { outcome: "none", recipients: 0 };
  if (!force) {
    if (hour !== REMINDER_HOUR) return { ...result, outcome: "not-hour" };
    if ((await deps.push.getReminderDate()) === today) return { ...result, outcome: "done-today" };
  }

  for (const [userId, devices] of await directory.byUser()) {
    if (devices.length === 0) continue;
    try {
      const item = await deps.users.get(userId);
      if (!item || !item.data.consentVersion) continue;
      const reminders = deadlineReminders(item.data.saved ?? [], published, today);
      if (reminders.length === 0) continue;
      result.recipients += 1;
      await deliver(deps, directory, summary, userId, devices, composeReminder(reminders));
    } catch (err) {
      skipUser(summary, devices, err);
    }
  }

  await deps.push.saveReminderDate(today, now);
  return { ...result, outcome: result.recipients > 0 ? "sent" : "none" };
}
