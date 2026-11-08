// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 진짜 lib/remote 로 — 응답이 오지 않는 fetch 에서도 로그아웃이 끝나고 사본을 지우는지 (검토 1차 3번).
 * 토큰 갱신만 대역으로 둔다(oidc-client-ts 없이 access 토큰을 준다).
 */
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getSession: vi.fn(),
}));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import { AUTH_KEY, getSession, resetAuthForTests } from "@/lib/auth";
import { goTo } from "@/lib/redirect";
import { REMOTE_TIMEOUT_MS } from "@/lib/remote";
import { saveAnswers } from "@/lib/storage";
import { SYNC_META_KEY, logout, resetSyncForTests } from "@/lib/sync";
import { TEST_LOGOUT_URL, enableLogin, seedSyncMeta, signInAs } from "./auth-fixtures";

const hanging = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  enableLogin();
  signInAs("sub-a");
  vi.stubGlobal("fetch", hanging);
  hanging.mockClear();
  vi.mocked(getSession).mockResolvedValue({ accessToken: "at-1", sub: "sub-a", expiresAt: 9_999_999_999 });
  vi.mocked(goTo).mockReset();
});

afterEach(() => {
  resetSyncForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("로그아웃 — 서버가 답하지 않을 때", () => {
  it("PUT 이 매달려도 제한 시간 뒤 끝나고, 사본을 지우고, 못 올린 변경이 있다고 알린다", async () => {
    vi.useFakeTimers();
    seedSyncMeta("sub-a", { dirty: true });
    saveAnswers({ birthDate: "2002-03-14", region: "서울특별시 중구", status: "재직", incomeBracket: 3, housingType: "월세" });

    const pending = logout();
    await vi.advanceTimersByTimeAsync(REMOTE_TIMEOUT_MS);
    expect(await pending).toEqual({ discardedUnsynced: true });

    expect(hanging).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
  });
});
