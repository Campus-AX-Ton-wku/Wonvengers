import { describe, expect, it, vi } from "vitest";
import { runNotifier, type NotifierDeps } from "../src/notifier/run";
import type { PushMessage } from "../src/notifier/plan";
import type { StoredDevice } from "../src/push-store";
import type { StoredItem } from "../src/store";
import { policy, validPayload } from "./fixtures";
import type { HousingNotice } from "../../web/lib/notices";

const DAY = new Date("2026-11-16T02:00:00Z"); // 서울 11시 — 마감 알림(10시 회차)은 돌지 않는다
const TEN = new Date("2026-11-16T01:00:00Z"); // 서울 10시 — 마감 알림 회차
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
  reason?: string;
  fetchFails?: boolean;
  now?: Date;
  /** 마감 알림을 마지막으로 돌린 날 */
  remindedOn?: string | null;
  /** 새 청약 공고 (11/22) — 기본은 공고 없음 · 이미 알린 목록 빈 집합(지금 시험들은 공고 알림을 보내지 않는다) */
  notices?: HousingNotice[];
  announcedNotices?: string[] | null;
  noticesFail?: boolean;
}) {
  let announced: Set<string> | null = opts.announced === null ? null : new Set(opts.announced ?? []);
  const sent: { device: string; message: PushMessage }[] = [];
  const removed: string[] = [];
  const order: string[] = [];
  let remindedOn: string | null = opts.remindedOn ?? null;
  let announcedNotices: Set<string> | null = opts.announcedNotices === null ? null : new Set(opts.announcedNotices ?? []);
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
      getReminderDate: vi.fn(async () => remindedOn),
      saveReminderDate: vi.fn(async (date: string) => {
        order.push("save-reminded");
        remindedOn = date;
      }),
      getAnnouncedNotices: vi.fn(async () => (announcedNotices === null ? null : new Set(announcedNotices))),
      saveAnnouncedNotices: vi.fn(async (ids: ReadonlySet<string>) => {
        announcedNotices = new Set(ids);
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
    fetchNotices: vi.fn(async () => {
      if (opts.noticesFail) throw new Error("503");
      return opts.notices ?? [];
    }),
    send: vi.fn(async (d: StoredDevice, message: PushMessage) => {
      order.push("send");
      sent.push({ device: d.deviceId, message });
      return { outcome: opts.outcome?.(d) ?? "sent", ...(opts.reason ? { reason: opts.reason } : {}) };
    }),
    now: () => opts.now ?? DAY,
  };
  return { deps, sent, removed, order, announced: () => announced, remindedOn: () => remindedOn, announcedNotices: () => announcedNotices };
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
    const summary = await runNotifier(t.deps);
    expect(summary.outcome).toBe("fetch-failed");
    expect(summary.fetchError).toBe("Error: 503");
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
      failures: {},
      reminders: { outcome: "not-hour", recipients: 0 },
      notices: { outcome: "no-new", newNotices: 0, recipients: 0 },
    });
    expect(t.sent.map((s) => s.device)).toEqual(["a-d1", "a-d2"]);
    expect(t.sent[0].message.url).toBe("/find/policies/fresh");
    expect(t.order).toEqual(["send", "send", "save"]);
    expect(t.announced()).toEqual(new Set(["fresh"]));
  });

  it("저장된 답이 없거나 · 동의 버전이 없거나 · 지역이 없으면 보내지 않는다 — 조건이 맞는 정책이어도", async () => {
    const t = setup({
      announced: [],
      published: [fresh],
      devices: [device("none", 1), device("noconsent", 1), device("noregion", 1), device("ok", 1)],
      users: {
        none: null,
        noconsent: userItem({ consentVersion: "" as never }),
        noregion: userItem({ answers: { values: { ...validPayload().answers.values, region: null }, answeredKeys: [] } }),
        ok: userItem(),
      },
    });
    const summary = await runNotifier(t.deps);
    expect(t.sent.map((s) => s.device)).toEqual(["ok-d1"]);
    expect(summary.recipients).toBe(1);
  });

  it("해당 없음이면 보내지 않는다", async () => {
    const workersOnly = policy({ id: "w", discovery: { ...fresh.discovery, statuses: ["재직"] } });
    const t = setup({ announced: [], published: [workersOnly], devices: [device("student", 1)], users: { student: userItem() } });
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

  it("403 실패는 원인별로 센다", async () => {
    const t = setup({
      announced: [],
      published: [fresh],
      devices: [device("a", 1)],
      users: { a: userItem() },
      outcome: () => "failed",
      reason: "403",
    });
    const summary = await runNotifier(t.deps);
    expect(summary.devicesFailed).toBe(1);
    expect(summary.failures).toEqual({ "403": 1 });
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
    expect(summary.failures).toEqual({ Error: 1 });
  });

  it("마감된 새 정책만 있으면 보내지 않고 '이미 알림'에만 적는다", async () => {
    const closed = policy({ id: "closed", applicationEnd: "2026-11-01" });
    const t = setup({ announced: [], published: [closed], devices: [device("a", 1)], users: { a: userItem() } });
    expect((await runNotifier(t.deps)).outcome).toBe("no-new");
    expect(t.sent).toEqual([]);
    expect(t.announced()).toEqual(new Set(["closed"]));
  });
});

describe("runNotifier — 찜한 지원금 마감 알림 (11/20)", () => {
  // TEN 은 서울 2026-11-16 10시 — 11/23 마감은 7일, 11/17 마감은 1일 남았다
  const d7 = policy({ id: "d7", name: "7일 남은 정책", applicationStart: "2026-11-01", applicationEnd: "2026-11-23" });
  const d1 = policy({ id: "d1", name: "내일 마감 정책", applicationStart: "2026-11-01", applicationEnd: "2026-11-17" });

  it("10시 회차에 찜한 사람의 기기마다 한 통, 보낸 뒤 오늘 날짜를 적는다", async () => {
    const t = setup({
      now: TEN,
      announced: ["d7", "d1"],
      published: [d7, d1],
      devices: [device("a", 1), device("b", 1)],
      users: { a: userItem({ saved: ["d7"] }), b: userItem({ saved: [] }) },
    });
    const summary = await runNotifier(t.deps);
    expect(summary.outcome).toBe("no-new");
    expect(summary.reminders).toEqual({ outcome: "sent", recipients: 1 });
    expect(summary.devicesSent).toBe(1);
    expect(t.sent).toEqual([
      { device: "a-d1", message: expect.objectContaining({ title: "관심 지원금 마감이 다가와요", url: "/find/policies/d7/prepare" }) },
    ]);
    expect(t.order).toEqual(["send", "save-reminded"]);
    expect(t.remindedOn()).toBe("2026-11-16");
  });

  it("같은 날 두 번 보내지 않는다 — 10시 회차가 다시 불려도(재시도)", async () => {
    const t = setup({
      now: TEN,
      announced: ["d7"],
      published: [d7],
      devices: [device("a", 1)],
      users: { a: userItem({ saved: ["d7"] }) },
      remindedOn: "2026-11-16",
    });
    expect((await runNotifier(t.deps)).reminders).toEqual({ outcome: "done-today", recipients: 0 });
    expect(t.sent).toEqual([]);
  });

  it("10시가 아니면 돌지 않는다", async () => {
    const t = setup({ announced: ["d7"], published: [d7], devices: [device("a", 1)], users: { a: userItem({ saved: ["d7"] }) } });
    expect((await runNotifier(t.deps)).reminders).toEqual({ outcome: "not-hour", recipients: 0 });
    expect(t.sent).toEqual([]);
  });

  it("force 면 시각 · 오늘 돌림을 보지 않고 보낸다 (시연)", async () => {
    const t = setup({
      now: NIGHT,
      announced: ["d1"],
      published: [d1],
      devices: [device("a", 1)],
      users: { a: userItem({ saved: ["d1"] }) },
      remindedOn: "2026-11-16",
    });
    const summary = await runNotifier(t.deps, { force: true });
    expect(summary.reminders).toEqual({ outcome: "sent", recipients: 1 });
    expect(t.sent[0].message.body).toBe("내일 마감 정책 — 내일 마감이에요. 신청 준비를 확인해 보세요");
  });

  it("동의 버전이 없으면 찜이 있어도 보내지 않는다", async () => {
    const t = setup({
      now: TEN,
      announced: ["d7"],
      published: [d7],
      devices: [device("a", 1)],
      users: { a: userItem({ saved: ["d7"], consentVersion: "" as never }) },
    });
    expect((await runNotifier(t.deps)).reminders).toEqual({ outcome: "none", recipients: 0 });
    expect(t.sent).toEqual([]);
  });

  it("새 정책 알림과 같은 회차면 구독 목록은 한 번만 읽고, 끊긴 기기는 두 번째 발송에서 빠진다", async () => {
    const fresh2 = policy({ id: "fresh2", name: "새 정책" });
    const t = setup({
      now: TEN,
      announced: ["d7"],
      published: [d7, fresh2],
      devices: [device("a", 1), device("a", 2)],
      users: { a: userItem({ saved: ["d7"] }) },
      outcome: (d) => (d.deviceId === "a-d2" ? "gone" : "sent"),
    });
    const summary = await runNotifier(t.deps);
    expect(t.deps.push.listDevices).toHaveBeenCalledTimes(1);
    expect(t.sent.map((s) => `${s.device}:${s.message.tag}`)).toEqual(["a-d1:new-policy", "a-d2:new-policy", "a-d1:deadline"]);
    expect(t.removed).toEqual(["a-d2"]);
    expect(summary.reminders).toEqual({ outcome: "sent", recipients: 1 });
  });
});

const notice = (id: string, over: Partial<HousingNotice> = {}): HousingNotice => ({
  id, source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", title: `${id} 공고`, supplier: "LH",
  announcedAt: "2026-11-14", applyStart: "2026-11-14", applyEnd: "2026-12-30", url: "https://apply.lh.or.kr/x", address: null, ...over,
});

describe("runNotifier — 새 청약 공고 (11/22)", () => {
  it("처음엔 지금 공고를 '알림'으로 적기만 하고 보내지 않는다 — 배포 직후 한꺼번에 가지 않게", async () => {
    const t = setup({ notices: [notice("a"), notice("b")], announcedNotices: null, announced: [], devices: [device("u", 1)], users: { u: userItem() } });
    const summary = await runNotifier(t.deps);
    expect(summary.notices?.outcome).toBe("initialized");
    expect(t.sent.filter((s) => s.message.tag === "notice")).toEqual([]);
    expect([...(t.announcedNotices() ?? [])].sort()).toEqual(["a", "b"]);
  });

  it("새 공고는 익산에 사는 사람에게 한 통, 누르면 /housing", async () => {
    const elsewhere = userItem({ answers: { values: { birthDate: "2002-03-14", region: null, status: "대학생", incomeBracket: 1, housingType: "월세" }, answeredKeys: [] } });
    const t = setup({ notices: [notice("a"), notice("b")], announcedNotices: ["a"], announced: [], devices: [device("u", 1), device("v", 1)], users: { u: userItem(), v: elsewhere } });
    const summary = await runNotifier(t.deps);
    expect(summary.notices).toMatchObject({ outcome: "sent", newNotices: 1, recipients: 1 });
    expect(t.sent.filter((s) => s.message.tag === "notice")).toEqual([
      { device: "u-d1", message: { title: "익산에 새 청약 공고가 올라왔어요", body: "b 공고", url: "/housing", tag: "notice" } },
    ]);
    expect(t.announcedNotices()?.has("b")).toBe(true);
  });

  it("공고 목록을 못 읽어도 정책 알림은 돈다", async () => {
    const t = setup({ noticesFail: true, published: [fresh], announced: [], devices: [device("u", 1)], users: { u: userItem() } });
    const summary = await runNotifier(t.deps);
    expect(summary.notices?.outcome).toBe("fetch-failed");
    expect(summary.outcome).toBe("sent");
  });
});
