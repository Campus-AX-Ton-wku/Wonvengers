import { vi } from "vitest";
import { AUTH_KEY, CONSENT_KEY } from "@/lib/auth";
import { CONSENT_VERSION } from "@/lib/user-data";

/**
 * 로그인을 켠 상태의 환경변수. 기본(아무것도 안 넣음)은 "로그인을 쓸 수 없음" 이다 —
 * 테스트 파일 맨 끝 afterEach 에서 vi.unstubAllEnvs() 로 되돌린다.
 */
export const TEST_AUTH_ENV = {
  NEXT_PUBLIC_COGNITO_DOMAIN: "perky-test.auth.ap-northeast-2.amazoncognito.com",
  NEXT_PUBLIC_COGNITO_CLIENT_ID: "test-client",
  NEXT_PUBLIC_API_URL: "https://api.test.example",
} as const;

/** jsdom 의 기본 주소는 http://localhost:3000 이다. */
export const TEST_LOGOUT_URL =
  "https://perky-test.auth.ap-northeast-2.amazoncognito.com/logout?client_id=test-client&logout_uri=http%3A%2F%2Flocalhost%3A3000%2F";

export function enableLogin(): void {
  for (const [name, value] of Object.entries(TEST_AUTH_ENV)) vi.stubEnv(name, value);
}

/** 이 기기에 로그인 기록(refresh token + sub)을 심는다. consent 면 동의 기록도. */
export function signInAs(sub = "sub-a", { consent = true }: { consent?: boolean } = {}): void {
  window.localStorage.setItem(AUTH_KEY, JSON.stringify({ refreshToken: `rt-${sub}`, sub }));
  if (consent) {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ sub, version: CONSENT_VERSION, at: "2026-11-04T09:00:00.000Z" })
    );
  }
}
