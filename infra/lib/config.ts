/**
 * 스택이 쓰는 고정 값. 설계 문서(docs/기획/2026-11-04-카카오-로그인-설계.md)의 값을 그대로 옮겼다.
 * 비밀값은 여기 두지 않는다 — SSM 파라미터 이름만.
 */
export const ACCOUNT = "448842988711";
export const REGION = "ap-northeast-2";

export const ALLOWED_ORIGINS = ["https://wonvengers.vercel.app", "http://localhost:3000"] as const;
export const CALLBACK_URLS = ALLOWED_ORIGINS.map((origin) => `${origin}/auth/callback`);
export const LOGOUT_URLS = ALLOWED_ORIGINS.map((origin) => `${origin}/`);

export const DOMAIN_PREFIX = "perky-wonvengers";
export const TABLE_NAME = "perky-user-data";

/** https://kauth.kakao.com/.well-known/openid-configuration (2026-11-04 연결 시험) */
export const KAKAO_OIDC = {
  issuer: "https://kauth.kakao.com",
  authorization: "https://kauth.kakao.com/oauth/authorize",
  token: "https://kauth.kakao.com/oauth/token",
  userInfo: "https://kapi.kakao.com/v1/oidc/userinfo",
  jwks: "https://kauth.kakao.com/.well-known/jwks.json",
} as const;

export const SSM_PARAMS = {
  clientId: "/perky/kakao/client-id",
  clientSecret: "/perky/kakao/client-secret",
  adminKey: "/perky/kakao/admin-key",
} as const;
