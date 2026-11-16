// apps/web/lib/__tests__/push.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/remote", () => ({ putPushRemote: vi.fn(async () => {}), deletePushRemote: vi.fn(async () => {}) }));

import { deletePushRemote, putPushRemote } from "@/lib/remote";
import {
  disablePush,
  disablePushQuietly,
  enablePush,
  isPushConfigured,
  pushState,
  pushSupport,
  refreshPush,
  unsubscribeThisDevice,
} from "@/lib/push";
import { enableLogin } from "./auth-fixtures";

const KEY = "BPublicKeyForTests";

function fakeSubscription(endpoint = "https://push.example/abc") {
  return {
    endpoint,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "BPub", auth: "Auth" } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function installPush(opts: { permission?: NotificationPermission; answer?: NotificationPermission; subscribed?: boolean } = {}) {
  let current: ReturnType<typeof fakeSubscription> | null = opts.subscribed ? fakeSubscription() : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = fakeSubscription())),
  };
  const registration = { pushManager };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(window.navigator, "serviceWorker", { value: serviceWorker, configurable: true });
  const notification = {
    permission: opts.permission ?? "default",
    requestPermission: vi.fn(async () => {
      notification.permission = opts.answer ?? "granted";
      return notification.permission;
    }),
  };
  vi.stubGlobal("Notification", notification);
  return { pushManager, serviceWorker, notification, current: () => current };
}

beforeEach(() => {
  vi.mocked(putPushRemote).mockReset().mockResolvedValue(undefined);
  vi.mocked(deletePushRemote).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, "serviceWorker");
});

describe("isPushConfigured", () => {
  it("로그인을 쓸 수 있고 공개 키가 있을 때만", () => {
    expect(isPushConfigured()).toBe(false);
    enableLogin();
    expect(isPushConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", KEY);
    expect(isPushConfigured()).toBe(true);
  });
});

describe("pushSupport", () => {
  const win = (ua: string, opts: { standalone?: boolean; capable?: boolean } = {}) =>
    ({
      navigator: { userAgent: ua, platform: "", maxTouchPoints: 0, standalone: opts.standalone, ...(opts.capable === false ? {} : { serviceWorker: {} }) },
      ...(opts.capable === false ? {} : { PushManager: function PushManager() {}, Notification: {} }),
      matchMedia: () => ({ matches: false }),
    }) as unknown as Window;
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)";

  it("아이폰 사파리 탭이면 홈 화면에 추가하라고", () => {
    expect(pushSupport(win(IPHONE))).toBe("needs-home-screen");
  });

  it("아이폰 홈 화면 앱이면 ready", () => {
    expect(pushSupport(win(IPHONE, { standalone: true }))).toBe("ready");
  });

  it("데스크톱 크롬은 ready, 기능이 없으면 unsupported", () => {
    expect(pushSupport(win("Mozilla/5.0 (Windows NT 10.0) Chrome/130"))).toBe("ready");
    expect(pushSupport(win("Mozilla/5.0 (Windows NT 10.0) Chrome/130", { capable: false }))).toBe("unsupported");
  });
});

describe("enablePush", () => {
  beforeEach(() => {
    enableLogin();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", KEY);
  });

  it("권한을 먼저 묻고(버튼 누른 그 순간), 워커를 등록하고, 구독해 서버에 endpoint · keys 만 보낸다", async () => {
    const fake = installPush();
    expect(await enablePush()).toBe("on");
    expect(fake.notification.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(
      fake.serviceWorker.register.mock.invocationCallOrder[0]
    );
    expect(fake.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(fake.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(putPushRemote).toHaveBeenCalledWith({ endpoint: "https://push.example/abc", keys: { p256dh: "BPub", auth: "Auth" } });
  });

  it("권한을 거부하면 denied, 구독하지 않는다", async () => {
    const fake = installPush({ answer: "denied" });
    expect(await enablePush()).toBe("denied");
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
    expect(putPushRemote).not.toHaveBeenCalled();
  });

  it("서버 저장이 실패하면 기기 구독도 끊고 던진다 — '켜짐'인데 안 오는 일이 없게", async () => {
    const fake = installPush();
    vi.mocked(putPushRemote).mockRejectedValueOnce(new Error("500"));
    await expect(enablePush()).rejects.toThrow();
    expect(fake.current()?.unsubscribe).toHaveBeenCalled();
  });
});

describe("pushState · disablePush · refreshPush", () => {
  it("권한 거부 → denied, 구독 있음 + 허용 → on, 그 밖 → off", async () => {
    installPush({ permission: "denied" });
    expect(await pushState()).toBe("denied");
    installPush({ permission: "granted", subscribed: true });
    expect(await pushState()).toBe("on");
    installPush({ permission: "granted" });
    expect(await pushState()).toBe("off");
  });

  it("끄기는 서버에서 지우고 기기 구독을 끊는다 — 서버가 실패해도 기기는 끊는다", async () => {
    const fake = installPush({ permission: "granted", subscribed: true });
    const sub = fake.current()!;
    vi.mocked(deletePushRemote).mockRejectedValueOnce(new Error("offline"));
    await disablePush();
    expect(deletePushRemote).toHaveBeenCalledWith("https://push.example/abc");
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("갱신은 구독 중일 때만 서버에 다시 알린다", async () => {
    installPush({ permission: "granted" });
    await refreshPush();
    expect(putPushRemote).not.toHaveBeenCalled();
    installPush({ permission: "granted", subscribed: true });
    await refreshPush();
    expect(putPushRemote).toHaveBeenCalledTimes(1);
  });
});

describe("로그아웃 · 탈퇴용", () => {
  it("disablePushQuietly — 서비스 워커가 없으면 바로 끝, 매달려도 제한 시간 뒤 끝", async () => {
    await expect(disablePushQuietly()).resolves.toBeUndefined();
    installPush({ permission: "granted", subscribed: true });
    vi.mocked(deletePushRemote).mockImplementationOnce(() => new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const done = disablePushQuietly(3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(done).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unsubscribeThisDevice — 서버는 부르지 않고 기기 구독만 끊는다", async () => {
    const fake = installPush({ permission: "granted", subscribed: true });
    const sub = fake.current()!;
    await unsubscribeThisDevice();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(deletePushRemote).not.toHaveBeenCalled();
  });
});
