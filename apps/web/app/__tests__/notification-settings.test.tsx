// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import NotificationSettingsPage from "@/app/notifications/settings/page";
import { resetAuthForTests } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

/** 알림함 ⚙ 의 두 번째 화면 (11/20 두 단계 구조 — 당근 · 토스처럼 알림함 → 알림 설정) */
describe("/notifications/settings — 알림 설정", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다", () => {
    enableLogin();
    render(<NotificationSettingsPage />);
    expect(replacePage).toHaveBeenCalledWith("/onboarding");
  });

  it("휴대폰 알림 칸이 여기 있다 — 예전 내 정보 › 알림 칸을 옮겼다", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublicKeyForTests");
    enableLogin(); signInAs();
    render(<NotificationSettingsPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "알림 설정" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "휴대폰 알림" })).toBeTruthy();
  });

  it("상단바 오른쪽은 비어 있다 — 종(알림함)은 ← 와 같은 곳", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublicKeyForTests");
    enableLogin(); signInAs();
    render(<NotificationSettingsPage />);
    const topBar = await screen.findByTestId("top-bar-row");
    expect(within(topBar).queryByRole("link", { name: /^알림/ })).toBeNull();
  });
});
