// apps/web/lib/__tests__/sync-push.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 로그아웃 · 탈퇴가 이 기기의 알림 구독을 끊는지 (설계 "로그아웃 · 탈퇴"). */
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getSession: vi.fn(),
}));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/remote")>()),
  deleteAccountRemote: vi.fn(),
}));
vi.mock("@/lib/push", () => ({
  disablePushQuietly: vi.fn(async () => {}),
  unsubscribeThisDevice: vi.fn(async () => {}),
}));

import { getSession, resetAuthForTests } from "@/lib/auth";
import { disablePushQuietly, unsubscribeThisDevice } from "@/lib/push";
import { goTo } from "@/lib/redirect";
import { deleteAccountRemote } from "@/lib/remote";
import { logout, resetSyncForTests, withdraw } from "@/lib/sync";
import { enableLogin, signInAs } from "./auth-fixtures";

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  enableLogin();
  signInAs("sub-a");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  vi.mocked(getSession).mockResolvedValue({ accessToken: "at-1", sub: "sub-a", expiresAt: 9_999_999_999 });
  vi.mocked(goTo).mockReset();
  vi.mocked(disablePushQuietly).mockReset().mockResolvedValue(undefined);
  vi.mocked(unsubscribeThisDevice).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteAccountRemote).mockReset();
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("로그아웃 · 탈퇴와 알림 구독", () => {
  it("로그아웃은 Cognito 로 떠나기 전에 이 기기 구독을 끊는다 (토큰이 있을 때 서버에서도 지우려고)", async () => {
    const order: string[] = [];
    vi.mocked(disablePushQuietly).mockImplementation(async () => {
      order.push("push");
    });
    vi.mocked(goTo).mockImplementation(() => {
      order.push("goTo");
    });
    await logout();
    expect(order).toEqual(["push", "goTo"]);
  });

  it("탈퇴가 성공하면 이 기기 구독을 끊는다", async () => {
    vi.mocked(deleteAccountRemote).mockResolvedValueOnce(undefined);
    await withdraw();
    expect(unsubscribeThisDevice).toHaveBeenCalledTimes(1);
  });

  it("탈퇴가 실패하면 구독을 건드리지 않는다", async () => {
    vi.mocked(deleteAccountRemote).mockRejectedValueOnce(new Error("500"));
    await expect(withdraw()).rejects.toThrow();
    expect(unsubscribeThisDevice).not.toHaveBeenCalled();
  });
});
