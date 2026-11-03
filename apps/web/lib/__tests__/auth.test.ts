// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oidc = vi.hoisted(() => ({
  settings: [] as unknown[],
  createSigninRequest: vi.fn(),
  processSigninResponse: vi.fn(),
  useRefreshToken: vi.fn(),
}));

vi.mock("oidc-client-ts", () => {
  class ErrorResponse extends Error {
    constructor(args: { error?: string | null }) {
      super(args.error ?? "error");
    }
  }
  class OidcClient {
    constructor(settings: unknown) {
      oidc.settings.push(settings);
    }
    createSigninRequest = oidc.createSigninRequest;
    processSigninResponse = oidc.processSigninResponse;
    useRefreshToken = oidc.useRefreshToken;
  }
  // 3.5.0 이 런타임에 내보내는 것만 둔다 — RefreshState 는 타입 선언에만 있다.
  return { ErrorResponse, OidcClient };
});
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import { ErrorResponse } from "oidc-client-ts";
import { goTo } from "@/lib/redirect";
import {
  AUTH_KEY,
  RETURN_KEY,
  consentAtFor,
  consumeReturnTo,
  forgetConsent,
  getSession,
  handleCallback,
  hasConsent,
  hasStoredLogin,
  isLoginAvailable,
  onAuthChange,
  recordConsent,
  resetAuthForTests,
  safeReturnTo,
  signIn,
  signOut,
  storedSub,
} from "@/lib/auth";
import { TEST_LOGOUT_URL, enableLogin, signInAs } from "./auth-fixtures";

const NOW = 1_793_000_000; // epoch 초

function signinResponse(over: Record<string, unknown> = {}) {
  return {
    access_token: "at-1",
    refresh_token: "rt-1",
    expires_at: NOW + 3600,
    profile: { sub: "sub-a" },
    ...over,
  };
}

function storageValues(): string[] {
  const values: string[] = [];
  for (let i = 0; i < localStorage.length; i++) values.push(localStorage.getItem(localStorage.key(i)!) ?? "");
  return values;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
  oidc.settings.length = 0;
  oidc.createSigninRequest.mockReset();
  oidc.processSigninResponse.mockReset();
  oidc.useRefreshToken.mockReset();
  vi.mocked(goTo).mockReset();
  resetAuthForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("환경변수가 없으면 로그인을 쓸 수 없다", () => {
  it("셋 중 하나라도 없으면 false 이고 로그인 시도는 아무것도 하지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "perky-test.auth.ap-northeast-2.amazoncognito.com");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "test-client");
    expect(isLoginAvailable()).toBe(false);
    await signIn("/find/policies");
    expect(oidc.settings).toHaveLength(0);
    expect(goTo).not.toHaveBeenCalled();
  });

  it("예전 로그인 기록이 남아 있어도 세션을 만들지 않는다", async () => {
    signInAs();
    expect(await getSession()).toBeNull();
    expect(oidc.useRefreshToken).not.toHaveBeenCalled();
  });
});

describe("signIn", () => {
  it("Cognito Hosted UI 를 거쳐 카카오로 보낸다 (PKCE 는 oidc-client-ts 가 붙인다)", async () => {
    enableLogin();
    oidc.createSigninRequest.mockResolvedValue({ url: "https://perky-test.auth/oauth2/authorize?x=1" });

    await signIn("/find/policies");

    expect(oidc.settings[0]).toEqual({
      authority: "https://perky-test.auth.ap-northeast-2.amazoncognito.com",
      client_id: "test-client",
      redirect_uri: "http://localhost:3000/auth/callback",
      response_type: "code",
      scope: "openid",
      loadUserInfo: false,
      metadata: {
        issuer: "https://perky-test.auth.ap-northeast-2.amazoncognito.com",
        authorization_endpoint: "https://perky-test.auth.ap-northeast-2.amazoncognito.com/oauth2/authorize",
        token_endpoint: "https://perky-test.auth.ap-northeast-2.amazoncognito.com/oauth2/token",
        revocation_endpoint: "https://perky-test.auth.ap-northeast-2.amazoncognito.com/oauth2/revoke",
      },
    });
    expect(oidc.createSigninRequest).toHaveBeenCalledWith({ extraQueryParams: { identity_provider: "Kakao" } });
    expect(goTo).toHaveBeenCalledWith("https://perky-test.auth/oauth2/authorize?x=1");
    expect(sessionStorage.getItem(RETURN_KEY)).toBe("/find/policies");
  });

  it("돌아올 곳은 앱 안 경로만 — 바깥 주소·//·/auth/ 는 /find 로", () => {
    expect(safeReturnTo("/account")).toBe("/account");
    for (const bad of ["https://evil.example", "//evil.example", "/auth/callback", null, ""]) {
      expect(safeReturnTo(bad)).toBe("/find");
    }
  });

  it("consumeReturnTo 는 한 번 읽고 지운다", () => {
    sessionStorage.setItem(RETURN_KEY, "/find/policies");
    expect(consumeReturnTo()).toBe("/find/policies");
    expect(consumeReturnTo()).toBe("/find");
  });
});

describe("handleCallback", () => {
  it("access 토큰은 메모리에만, refresh token 과 sub 만 perky.auth 에", async () => {
    enableLogin();
    oidc.processSigninResponse.mockResolvedValue(signinResponse());

    const result = await handleCallback("http://localhost:3000/auth/callback?code=c&state=s");

    expect(oidc.processSigninResponse).toHaveBeenCalledWith("http://localhost:3000/auth/callback?code=c&state=s");
    expect(result).toEqual({ sub: "sub-a", needsConsent: true });
    expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toEqual({ refreshToken: "rt-1", sub: "sub-a" });
    expect(storageValues().some((v) => v.includes("at-1"))).toBe(false);
    expect(await getSession()).toEqual({ accessToken: "at-1", sub: "sub-a", expiresAt: NOW + 3600 });
    expect(oidc.useRefreshToken).not.toHaveBeenCalled();
  });

  it("이 기기에서 같은 사람이 지금 버전에 동의했으면 동의 화면을 건너뛴다", async () => {
    enableLogin();
    recordConsent("sub-a");
    oidc.processSigninResponse.mockResolvedValue(signinResponse());
    expect((await handleCallback("http://localhost:3000/auth/callback?code=c")).needsConsent).toBe(false);
  });

  it("다른 사람의 동의 기록으로는 건너뛰지 않는다", async () => {
    enableLogin();
    recordConsent("sub-b");
    oidc.processSigninResponse.mockResolvedValue(signinResponse());
    expect((await handleCallback("http://localhost:3000/auth/callback?code=c")).needsConsent).toBe(true);
  });

  it("카카오에서 취소하면(오류 응답) 던지고 아무것도 저장하지 않는다", async () => {
    enableLogin();
    oidc.processSigninResponse.mockRejectedValue(new ErrorResponse({ error: "access_denied" }));
    await expect(handleCallback("http://localhost:3000/auth/callback?error=access_denied")).rejects.toThrow();
    expect(hasStoredLogin()).toBe(false);
  });
});

describe("getSession — 토큰 갱신", () => {
  it("만료 1분 전이면 refresh token 으로 새 access 토큰을 받는다", async () => {
    enableLogin();
    signInAs("sub-a");
    oidc.useRefreshToken.mockResolvedValue(signinResponse({ access_token: "at-2", refresh_token: undefined }));

    const session = await getSession();

    expect(oidc.useRefreshToken).toHaveBeenCalledTimes(1);
    const { state } = oidc.useRefreshToken.mock.calls[0][0] as { state: { refresh_token: string; profile: { sub: string } } };
    expect(state.refresh_token).toBe("rt-sub-a");
    expect(state.profile.sub).toBe("sub-a");
    expect(session?.accessToken).toBe("at-2");
    // 갱신 응답에 refresh token 이 없으면 쓰던 것을 그대로 둔다.
    expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toEqual({ refreshToken: "rt-sub-a", sub: "sub-a" });
  });

  it("동시에 여러 번 불러도 갱신은 한 번", async () => {
    enableLogin();
    signInAs("sub-a");
    oidc.useRefreshToken.mockResolvedValue(signinResponse());
    await Promise.all([getSession(), getSession(), getSession()]);
    expect(oidc.useRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("서버가 갱신을 거절하면(만료·탈퇴) 로그아웃 상태가 되고 알린다", async () => {
    enableLogin();
    signInAs("sub-a");
    const listener = vi.fn();
    onAuthChange(listener);
    oidc.useRefreshToken.mockRejectedValue(new ErrorResponse({ error: "invalid_grant" }));

    expect(await getSession()).toBeNull();
    expect(hasStoredLogin()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("네트워크가 끊겨 실패하면 던지고 로그인 기록은 남긴다 — 다음에 다시 갱신한다", async () => {
    enableLogin();
    signInAs("sub-a");
    oidc.useRefreshToken.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getSession()).rejects.toThrow("Failed to fetch");
    expect(storedSub()).toBe("sub-a");
  });

  it("갱신으로 다른 사람이 돌아오면 받지 않는다", async () => {
    enableLogin();
    signInAs("sub-a");
    oidc.useRefreshToken.mockResolvedValue(signinResponse({ profile: { sub: "sub-b" } }));
    expect(await getSession()).toBeNull();
    expect(hasStoredLogin()).toBe(false);
  });
});

describe("signOut", () => {
  it("메모리·perky.auth 를 지우고 Cognito 로그아웃으로 보낸다", async () => {
    enableLogin();
    oidc.processSigninResponse.mockResolvedValue(signinResponse());
    await handleCallback("http://localhost:3000/auth/callback?code=c");

    signOut();

    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
    expect(await getSession()).toBeNull();
  });

  it("redirect: false 면 이동하지 않는다 (탈퇴 뒤)", () => {
    enableLogin();
    signInAs();
    signOut({ redirect: false });
    expect(hasStoredLogin()).toBe(false);
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe("동의 기록", () => {
  it("사람과 문구 버전이 같을 때만 동의로 본다", () => {
    const at = recordConsent("sub-a", new Date("2026-11-04T09:00:00.000Z"));
    expect(at).toBe("2026-11-04T09:00:00.000Z");
    expect(hasConsent("sub-a")).toBe(true);
    expect(hasConsent("sub-b")).toBe(false);
    expect(consentAtFor("sub-a")).toBe("2026-11-04T09:00:00.000Z");
    expect(consentAtFor("sub-b")).toBeNull();

    localStorage.setItem("perky.consent", JSON.stringify({ sub: "sub-a", version: "2025-01-01", at }));
    expect(hasConsent("sub-a")).toBe(false);

    forgetConsent();
    expect(localStorage.getItem("perky.consent")).toBeNull();
  });
});
