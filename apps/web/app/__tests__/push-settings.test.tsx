// apps/web/app/__tests__/push-settings.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/push", () => ({
  pushSupport: vi.fn(() => "ready"),
  pushState: vi.fn(async () => "off"),
  enablePush: vi.fn(async () => "on"),
  disablePush: vi.fn(async () => {}),
  refreshPush: vi.fn(async () => {}),
  pushOwner: vi.fn(() => "sub-a"),
  unsubscribeThisDevice: vi.fn(async () => {}),
}));

import PushSettings from "@/app/notifications/settings/PushSettings";
import { resetAuthForTests } from "@/lib/auth";
import { disablePush, enablePush, pushOwner, pushState, pushSupport, refreshPush, unsubscribeThisDevice } from "@/lib/push";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  resetAuthForTests();
  enableLogin();
  signInAs("sub-a");
  vi.mocked(pushSupport).mockReturnValue("ready");
  vi.mocked(pushState).mockResolvedValue("off");
  vi.mocked(enablePush).mockReset().mockResolvedValue("on");
  vi.mocked(disablePush).mockReset().mockResolvedValue(undefined);
  vi.mocked(refreshPush).mockReset().mockResolvedValue(undefined);
  vi.mocked(pushOwner).mockReset().mockReturnValue("sub-a");
  vi.mocked(unsubscribeThisDevice).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllEnvs();
});

describe("내 계정 — 알림 칸", () => {
  it("꺼져 있으면 설명과 [알림 켜기], 누르면 켜짐", async () => {
    render(<PushSettings />);
    expect(await screen.findByText("내 조건에 맞는 새 지원금이 올라오거나, 관심 지원금 마감이 7일 · 1일 남으면 알려 드려요 (낮 9시~밤 9시)")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "알림 켜기" }));
    expect(enablePush).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("알림 켜짐")).toBeTruthy();
    expect(screen.getByRole("button", { name: "알림 끄기" })).toBeTruthy();
  });

  it("켜져 있으면 [알림 끄기], 열 때 서버 구독을 갱신한다", async () => {
    vi.mocked(pushState).mockResolvedValue("on");
    render(<PushSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "알림 끄기" }));
    expect(disablePush).toHaveBeenCalledTimes(1);
    expect(refreshPush).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "알림 켜기" })).toBeTruthy();
  });

  it("다른 계정이 켠 구독이면 기기만 끊고 꺼짐으로 보여 준다", async () => {
    vi.mocked(pushState).mockResolvedValue("on");
    vi.mocked(pushOwner).mockReturnValue("sub-b");
    render(<PushSettings />);
    expect(await screen.findByRole("button", { name: "알림 켜기" })).toBeTruthy();
    expect(unsubscribeThisDevice).toHaveBeenCalledTimes(1);
    expect(refreshPush).not.toHaveBeenCalled();
  });

  it("아이폰 사파리 탭이면 홈 화면 안내만", async () => {
    vi.mocked(pushSupport).mockReturnValue("needs-home-screen");
    render(<PushSettings />);
    expect(await screen.findByText("홈 화면에 추가한 Perky에서 알림을 켤 수 있어요")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("지원하지 않는 브라우저", async () => {
    vi.mocked(pushSupport).mockReturnValue("unsupported");
    render(<PushSettings />);
    expect(await screen.findByText("이 브라우저는 알림을 지원하지 않아요")).toBeTruthy();
  });

  it("권한을 거부했으면 기기 설정 안내", async () => {
    vi.mocked(pushState).mockResolvedValue("denied");
    render(<PushSettings />);
    expect(await screen.findByText("알림이 꺼져 있어요. 기기 설정에서 Perky 알림을 허용해 주세요")).toBeTruthy();
  });

  it("답 저장에 동의하지 않았으면 켤 수 없다", async () => {
    window.localStorage.clear();
    signInAs("sub-a", { consent: false });
    render(<PushSettings />);
    expect(await screen.findByText("답을 저장해야 맞춤 알림을 받을 수 있어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "알림 켜기" })).toBeNull();
  });

  it("켜기가 실패하면 알리고 꺼진 채로 둔다", async () => {
    vi.mocked(enablePush).mockRejectedValueOnce(new Error("500"));
    render(<PushSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "알림 켜기" }));
    expect((await screen.findByRole("alert")).textContent).toBe("알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    expect(screen.getByRole("button", { name: "알림 켜기" })).toBeTruthy();
  });
});
