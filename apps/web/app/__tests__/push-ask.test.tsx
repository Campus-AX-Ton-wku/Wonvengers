// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/push")>()),
  isPushConfigured: vi.fn(() => true),
  pushSupport: vi.fn(() => "ready"),
  pushState: vi.fn(async () => "off"),
  pushOwner: vi.fn(() => null),
  enablePush: vi.fn(async () => "on"),
}));
vi.mock("@/lib/toast", () => ({ showToast: vi.fn(), onToast: vi.fn(() => () => {}) }));

import HomePage from "@/app/home/page";
import NotificationsPage from "@/app/notifications/page";
import { resetAuthForTests } from "@/lib/auth";
import { enablePush, isPushConfigured, pushOwner, pushState, pushSupport } from "@/lib/push";
import { PUSH_ASK_INTERVAL_DAYS, markPushAsked, pushAskFor } from "@/lib/push-ask";
import { clearDeviceRecords, homeReachedBy, saveAnswers } from "@/lib/storage";
import { showToast } from "@/lib/toast";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

/** 알림 허용을 먼저 묻는 때 (11/23 ggue) — 홈 첫 진입 · [나중에]면 7일마다 · 알림함 첫 방문 · 아이폰 Safari 는 홈 화면 추가 안내 */

const 익산_재직 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "재직" as const, incomeBracket: 1, housingType: "월세" as const };
const NOW = new Date("2026-11-23T12:00:00+09:00");
const DAY = 24 * 60 * 60 * 1000;
const 묻는창 = { name: "새 지원금 소식, 알림으로 받을까요?" };

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  enableLogin();
  signInAs("sub-a");
  saveAnswers(익산_재직);
  vi.stubGlobal("Notification", { permission: "default" });
  vi.mocked(isPushConfigured).mockReturnValue(true);
  vi.mocked(pushSupport).mockReturnValue("ready");
  vi.mocked(pushState).mockResolvedValue("off");
  vi.mocked(pushOwner).mockReturnValue(null);
  vi.mocked(enablePush).mockReset().mockResolvedValue("on");
  vi.mocked(showToast).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("pushAskFor — 언제 묻나", () => {
  it("로그인하고 처음이면 홈에서 묻는다", async () => {
    expect(await pushAskFor("home", NOW)).toBe("ask");
  });

  it("[나중에] 뒤 7일이 지나기 전에는 홈에서 다시 묻지 않고, 7일이 지나면 다시 묻는다", async () => {
    markPushAsked("home", NOW);
    expect(await pushAskFor("home", new Date(NOW.getTime() + (PUSH_ASK_INTERVAL_DAYS - 1) * DAY))).toBeNull();
    expect(await pushAskFor("home", new Date(NOW.getTime() + PUSH_ASK_INTERVAL_DAYS * DAY))).toBe("ask");
  });

  it("알림함은 처음 들어갔을 때 한 번 — 홈에서 막 물었어도 묻는다", async () => {
    markPushAsked("home", NOW);
    expect(await pushAskFor("inbox", NOW)).toBe("ask");
    markPushAsked("inbox", NOW);
    expect(await pushAskFor("inbox", new Date(NOW.getTime() + DAY))).toBeNull();
  });

  it("아이폰 Safari(홈 화면에 추가 안 함)면 홈 화면 추가 안내", async () => {
    vi.mocked(pushSupport).mockReturnValue("needs-home-screen");
    expect(await pushAskFor("home", NOW)).toBe("home-screen");
  });

  it("이미 켜져 있으면 묻지 않는다 — 다른 계정이 켠 구독이면 묻는다", async () => {
    vi.mocked(pushState).mockResolvedValue("on");
    vi.mocked(pushOwner).mockReturnValue("sub-a");
    expect(await pushAskFor("home", NOW)).toBeNull();
    vi.mocked(pushOwner).mockReturnValue("sub-b");
    expect(await pushAskFor("home", NOW)).toBe("ask");
  });

  it("기기 설정에서 거부했거나 · 알림을 못 쓰는 브라우저 · 알림 없는 빌드 · 저장 동의 전 · 로그인 전이면 묻지 않는다", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    expect(await pushAskFor("home", NOW)).toBeNull();
    vi.stubGlobal("Notification", { permission: "default" });

    vi.mocked(pushSupport).mockReturnValue("unsupported");
    expect(await pushAskFor("home", NOW)).toBeNull();
    vi.mocked(pushSupport).mockReturnValue("ready");

    vi.mocked(isPushConfigured).mockReturnValue(false);
    expect(await pushAskFor("home", NOW)).toBeNull();
    vi.mocked(isPushConfigured).mockReturnValue(true);

    window.localStorage.clear();
    resetAuthForTests();
    signInAs("sub-a", { consent: false });
    expect(await pushAskFor("home", NOW)).toBeNull();

    window.localStorage.clear();
    resetAuthForTests();
    expect(await pushAskFor("home", NOW)).toBeNull();
  });

  it("기록은 계정마다 — 다른 계정이면 처음부터, 로그아웃하면 지운다", async () => {
    markPushAsked("home", NOW);
    signInAs("sub-b");
    resetAuthForTests();
    expect(await pushAskFor("home", NOW)).toBe("ask");

    signInAs("sub-a");
    resetAuthForTests();
    expect(await pushAskFor("home", NOW)).toBeNull();
    clearDeviceRecords();
    expect(await pushAskFor("home", NOW)).toBe("ask");
  });
});

describe("홈 — 로그인하고 처음 들어오면", () => {
  it("알림 허용 창을 먼저 띄우고, 닫은 뒤에야 배지 판정을 시작한다", async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    expect(await screen.findByRole("dialog", 묻는창)).toBeTruthy();
    expect(homeReachedBy("sub-a")).toBe(false);

    await user.click(screen.getByRole("button", { name: "나중에" }));
    expect(screen.queryByRole("dialog", 묻는창)).toBeNull();
    expect(homeReachedBy("sub-a")).toBe(true);
    expect(enablePush).not.toHaveBeenCalled();
  });

  it("[알림 받기]는 그 자리에서 기기 권한을 묻고, 켜지면 짧게 알린다", async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(await screen.findByRole("button", { name: "알림 받기" }));
    expect(enablePush).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({ message: "알림을 켰어요" });
    expect(screen.queryByRole("dialog", 묻는창)).toBeNull();
    expect(homeReachedBy("sub-a")).toBe(true);
  });

  it("켜지 못하면 창 안에서 알리고 다시 누를 수 있다", async () => {
    vi.mocked(enablePush).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(await screen.findByRole("button", { name: "알림 받기" }));
    expect((await screen.findByRole("alert")).textContent).toBe("알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    expect((screen.getByRole("button", { name: "알림 받기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("두 번째로 들어오면(7일 안) 묻지 않고 바로 배지 판정", async () => {
    markPushAsked("home");
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    await vi.waitFor(() => expect(homeReachedBy("sub-a")).toBe(true));
    expect(screen.queryByRole("dialog", 묻는창)).toBeNull();
  });

  it("아이폰 Safari 면 홈 화면 추가 안내 — [알겠어요]로 닫는다", async () => {
    vi.mocked(pushSupport).mockReturnValue("needs-home-screen");
    const user = userEvent.setup();
    render(<HomePage />);
    expect(await screen.findByRole("dialog", { name: "홈 화면에 추가하면 알림을 받을 수 있어요" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "알겠어요" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(enablePush).not.toHaveBeenCalled();
  });
});

describe("알림함 — 오른쪽 위 종으로 처음 들어오면", () => {
  it("한 번 묻고, 다음에 들어오면 묻지 않는다", async () => {
    markPushAsked("home"); // 홈에서 이미 물었어도
    const user = userEvent.setup();
    const first = render(<NotificationsPage />);
    expect(await screen.findByRole("dialog", 묻는창)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "나중에" }));
    first.unmount();

    render(<NotificationsPage />);
    await screen.findByRole("heading", { level: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog", 묻는창)).toBeNull();
  });
});
