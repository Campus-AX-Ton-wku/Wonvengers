import { describe, expect, it, vi } from "vitest";
import { runNotifier, type NotifierDeps } from "../src/notifier/run";
import type { PushMessage } from "../src/notifier/plan";
import type { StoredDevice } from "../src/push-store";
import type { StoredItem } from "../src/store";
import { validPayload } from "./fixtures";
import { policy } from "./fixtures";

const DAY = new Date("2026-11-16T01:00:00Z"); // 서울 10시
const NIGHT = new Date("2026-11-16T14:00:00Z"); // 서울 23시

const device = (userId: string, n: number): StoredDevice => ({
  userId,
  deviceId: `${userId}-d${n}`,
  endpoint: `https://push.example/${userId}/${n}`,
  keys: { p256dh: "p", auth: "a" },
  updatedAt: "2026-11-16T00:00:00.000Z",
});

const userItem = (over: Partial<StoredItem["data"]> = {}): StoredItem => ({
  data: validPayload(over),
  updatedAt: "2026-11-16T00:00:00.000Z",
});

function setup(opts: {
  published?: ReturnType<typeof policy>[];
  announced?: string[] | null;
  devices?: StoredDevice[];
  users?: Record<string, StoredItem | null>;
  outcome?: (d: StoredDevice) => "sent" | "gone" | "failed";
  fetchFails?: boolean;
  now?: Date;
}) {
  let announced: Set<string> | null = opts.announced === null ? null : new Set(opts.announced ?? []);
  const sent: { device: string; message: PushMessage }[] = [];
  const removed: string[] = [];
  const order: string[] = [];
  const deps: NotifierDeps = {
    push: {
      listDevices: vi.fn(async () => opts.devices ?? []),
      deleteDevice: vi.fn(async (_u: string, d: string) => {
        removed.push(d);
      }),
      getAnnounced: vi.fn(async () => (announced === null ? null : new Set(announced))),
      saveAnnounced: vi.fn(async (ids: ReadonlySet<string>) => {
        order.push("save");
        announced = new Set(ids);
      }),
    },
    users: {
      get: vi.fn(async (userId: string) => {
        if (userId === "boom") throw new Error("ddb down");
        return opts.users?.[userId] ?? null;
      }),
    },
    fetchPolicies: vi.fn(async () => {
      if (opts.fetchFails) throw new Error("503");
      return opts.published ?? [];
    }),
    send: vi.fn(async (d: StoredDevice, message: PushMessage) => {
      order.push("send");
      sent.push({ device: d.deviceId, message });
      return opts.outcome?.(d) ?? "sent";
    }),
    now: () => opts.now ?? DAY,
  };
  return { deps, sent, removed, order, announced: () => announced };
}

const fresh = policy({ id: "fresh", name: "새 정책" });

describe("runNotifier — 시간 · 첫 실행 · 실패", () => {
  it("서울 9~21시 밖이면 아무것도 읽지 않는다", async () => {
    const t = setup({ now: NIGHT, published: [fresh] });
    expect((await runNotifier(t.deps)).outcome).toBe("skipped-hours");
    expect(t.deps.fetchPolicies).not.toHaveBeenCalled();
  });

  it("force 면 밤에도 돈다 (시연 · 손으로 실행)", async () => {
    const t = setup({ now: NIGHT, published: [fresh], announced: [], devices: [device("a", 1)], users: { a: userItem() } });
    expect((await runNotifier(t.deps, { force: true })).outcome).toBe("sent");
  });

  it("목록을 못 읽으면 그 회차는 건너뛰고 상태를 건드리지 않는다", async () => {
    const t = setup({ fetchFails: true, announced: [] });
    expect((await runNotifier(t.deps)).outcome).toBe("fetch-failed");
    expect(t.deps.push.saveAnnounced).not.toHaveBeenCalled();
  });

  it("첫 실행은 지금 목록을 전부 '이미 알림'으로 적고 보내지 않는다", async () => {
    const t = setup({ announced: null, published: [policy({ id: "a" }), policy({ id: "b" })], devices: [device("a", 1)] });
    expect((await runNotifier(t.deps)).outcome).toBe("initialized");
    expect(t.sent).toEqual([]);
    expect(t.announced()).toEqual(new Set(["a", "b"]));
  });

  it("새 정책이 없으면 no-new — 구독도 읽지 않는다", async () => {
    const t = setup({ announced: ["fresh"], published: [fresh] });
    expect((await runNotifier(t.deps)).outcome).toBe("no-new");
    expect(t.deps.push.listDevices).not.toHaveBeenCalled();
  });
});

describe("runNotifier — 보내기", () => {
  it("조건 맞는 사용자의 기기마다 한 통, 보낸 뒤에 '이미 알림'을 적는다", async () => {
    const t = setup({
      announced: [],
      published: [fresh],
      devices: [device("a", 1), device("a", 2)],
      users: { a: userItem() },
    });
    const summary = await runNotifier(t.deps);
    expect(summary).toEqual({
      outcome: "sent",
      newPolicies: 1,
      recipients: 1,
      devicesSent: 2,
      devicesFailed: 0,
      devicesRemoved: 0,
    });
    expect(t.sent.map((s) => s.device)).toEqual(["a-d1", "a-d2"]);
    expect(t.sent[0].message.url).toBe("/find/policies/fresh");
    expect(t.order).toEqual(["send", "send", "save"]);
    expect(t.announced()).toEqual(new Set(["fresh"]));
  });

  it("저장된 답이 없거나 · 동의 버전이 없거나 · 지역이 없거나 · 해당 없으면 보내지 않는다", async () => {
    const workersOnly = policy({ id: "w", discovery: { ...fresh.discovery, statuses: ["재직"] } });
    const t = setup({
      announced: [],
      published: [workersOnly],
      devices: [device("none", 1), device("noconsent", 1), device("noregion", 1), device("student", 1)],
      users: {
        none: null,
        noconsent: userItem({ consentVersion: "" as never }),
        noregion: userItem({ answers: { values: { ...validPayload().answers.values, region: null }, answeredKeys: [] } }),
        student: userItem(), // 대학생 → 재직 전용 정책은 해당 없음
      },
    });
    const summary = await runNotifier(t.deps);
    expect(t.sent).toEqual([]);
    expect(summary.recipients).toBe(0);
    expect(t.announced()).toEqual(new Set(["w"]));
  });

  it("끊긴 구독(gone)은 지우고, 실패(failed)는 세기만 한다", async () => {
    const t = setup({
      announced: [],
      published: [fresh],
      devices: [device("a", 1), device("a", 2), device("a", 3)],
      users: { a: userItem() },
      outcome: (d) => (d.deviceId === "a-d1" ? "gone" : d.deviceId === "a-d2" ? "failed" : "sent"),
    });
    const summary = await runNotifier(t.deps);
    expect(summary).toMatchObject({ devicesSent: 1, devicesFailed: 1, devicesRemoved: 1 });
    expect(t.removed).toEqual(["a-d1"]);
  });

  it("한 사용자에서 오류가 나도 다른 사용자에게는 보낸다", async () => {
    const t = setup({
      announced: [],
      published: [fresh],
      devices: [device("boom", 1), device("a", 1)],
      users: { a: userItem() },
    });
    const summary = await runNotifier(t.deps);
    expect(t.sent.map((s) => s.device)).toEqual(["a-d1"]);
    expect(summary.devicesFailed).toBe(1);
  });

  it("마감된 새 정책만 있으면 보내지 않고 '이미 알림'에만 적는다", async () => {
    const closed = policy({ id: "closed", applicationEnd: "2026-11-01" });
    const t = setup({ announced: [], published: [closed], devices: [device("a", 1)], users: { a: userItem() } });
    expect((await runNotifier(t.deps)).outcome).toBe("no-new");
    expect(t.sent).toEqual([]);
    expect(t.announced()).toEqual(new Set(["closed"]));
  });
});
