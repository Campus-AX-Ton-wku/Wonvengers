import type { OidcClient, OidcClientSettings, RefreshState, SigninResponse, UserProfile } from "oidc-client-ts";
import { goTo } from "./redirect";
import { CONSENT_VERSION } from "./user-data";

/**
 * 카카오 로그인 (docs/기획/2026-11-04-카카오-로그인-설계.md "구조"·"동기화 규칙").
 *
 * 브라우저 → Cognito Hosted UI(identity_provider=Kakao) → 카카오 → Cognito → /auth/callback →
 * PKCE 로 코드 교환. oidc-client-ts 의 OidcClient 를 쓴다 — UserManager 는 토큰 묶음을
 * 통째로 저장소에 두기 때문이다. 여기서는 access 토큰을 메모리에만 두고, refresh token 과
 * sub 만 localStorage(perky.auth)에 둔다(정적 사이트라 HttpOnly 쿠키를 쓸 수 없다).
 *
 * 메타데이터를 직접 넣어 discovery 요청을 보내지 않는다. 모듈은 로그인·갱신 때만 동적으로
 * 불러온다 — 로그인하지 않는 대부분의 방문자는 이 라이브러리를 받지 않는다.
 *
 * 환경변수 셋 중 하나라도 없으면 로그인을 쓸 수 없다. 그때는 어떤 함수도 네트워크를 쓰지 않는다.
 */

export const AUTH_KEY = "perky.auth";
export const CONSENT_KEY = "perky.consent";
/** 로그인 뒤 돌아갈 화면. 같은 탭 안에서만 필요해서 sessionStorage 에 둔다. */
export const RETURN_KEY = "perky.auth-return";

const DEFAULT_RETURN = "/find";
/** 만료 1분 전부터는 갱신한다 — 요청이 가는 사이에 만료되지 않게. */
const REFRESH_MARGIN_SECONDS = 60;

export interface AuthConfig {
  /** 호스트만. 예: perky-wonvengers.auth.ap-northeast-2.amazoncognito.com */
  domain: string;
  clientId: string;
  /** 끝의 / 를 뗀 API 주소 */
  apiUrl: string;
}

/** Next 는 process.env.NEXT_PUBLIC_* 를 빌드 때 글자 그대로 바꿔 넣는다 — 이 세 줄의 모양을 바꾸지 말 것. */
export function authConfig(): AuthConfig | null {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!domain || !clientId || !apiUrl) return null;
  return { domain, clientId, apiUrl: apiUrl.replace(/\/+$/, "") };
}

export function isLoginAvailable(): boolean {
  return authConfig() !== null;
}

export interface Session {
  accessToken: string;
  sub: string;
  /** epoch 초 */
  expiresAt: number;
}

interface StoredAuth {
  refreshToken: string;
  sub: string;
}

let session: Session | null = null;
let refreshing: Promise<Session | null> | null = null;
let clientPromise: Promise<OidcClient> | null = null;
let clientKey = "";
/** forgetLogin 마다 1 씩 오른다. 갱신 도중 로그아웃했으면 늦게 온 결과를 버린다(공용 PC). */
let generation = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 로그인·로그아웃이 바뀌면 부른다. 상단바 계정 칸과 /account 가 듣는다. */
export function onAuthChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStored(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredAuth>;
    return typeof value.refreshToken === "string" && typeof value.sub === "string"
      ? { refreshToken: value.refreshToken, sub: value.sub }
      : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredAuth | null): void {
  try {
    if (value) window.localStorage.setItem(AUTH_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(AUTH_KEY);
  } catch {
    // 저장이 막혀 있으면 이 탭에서만 로그인된다.
  }
}

export function storedSub(): string | null {
  return readStored()?.sub ?? null;
}

export function hasStoredLogin(): boolean {
  return readStored() !== null;
}

export function oidcSettings(config: AuthConfig, origin: string): OidcClientSettings {
  const base = `https://${config.domain}`;
  return {
    authority: base,
    client_id: config.clientId,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    scope: "openid",
    loadUserInfo: false,
    metadata: {
      issuer: base,
      authorization_endpoint: `${base}/oauth2/authorize`,
      token_endpoint: `${base}/oauth2/token`,
      revocation_endpoint: `${base}/oauth2/revoke`,
    },
  };
}

function client(config: AuthConfig): Promise<OidcClient> {
  const key = `${config.domain}|${config.clientId}`;
  if (clientPromise === null || clientKey !== key) {
    clientKey = key;
    clientPromise = import("oidc-client-ts").then(
      ({ OidcClient }) => new OidcClient(oidcSettings(config, window.location.origin))
    );
  }
  return clientPromise;
}

/** 로그인 뒤 돌아갈 곳은 앱 안 경로만. 바깥 주소로 튕기는 열린 리다이렉트를 막는다. */
export function safeReturnTo(value: string | null): string {
  // 브라우저는 \ 를 / 로 읽고 탭·CR·LF 를 지운다("/\\evil.com" → https://evil.com/). 그런 글자는 아예 받지 않고,
  // 나머지는 브라우저와 같은 URL 파서로 풀어 같은 출처인지 본다.
  if (!value || !value.startsWith("/") || /[\\\x00-\x1f\x7f]/.test(value)) return DEFAULT_RETURN;
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return DEFAULT_RETURN;
  }
  if (url.origin !== origin || url.pathname.startsWith("//") || url.pathname.startsWith("/auth/")) {
    return DEFAULT_RETURN;
  }
  return url.pathname + url.search + url.hash;
}

export function consumeReturnTo(): string {
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(RETURN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    value = null;
  }
  return safeReturnTo(value);
}

export async function signIn(returnTo: string): Promise<void> {
  const config = authConfig();
  if (!config) return;
  try {
    window.sessionStorage.setItem(RETURN_KEY, safeReturnTo(returnTo));
  } catch {
    // 못 적으면 기본 화면(/find)으로 돌아온다.
  }
  const request = await (await client(config)).createSigninRequest({
    extraQueryParams: { identity_provider: "Kakao" },
  });
  goTo(request.url);
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

function accept(response: SigninResponse, previousRefreshToken: string | null): Session {
  const sub = response.profile.sub;
  const refreshToken = response.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new Error("no refresh token");
  session = { accessToken: response.access_token, sub, expiresAt: response.expires_at ?? nowSeconds() + 3600 };
  writeStored({ refreshToken, sub });
  emit();
  return session;
}

/** /auth/callback 에서 부른다. 이 기기에서 이 사람이 지금 문구에 동의한 적이 없으면 needsConsent. */
export async function handleCallback(url: string): Promise<{ sub: string; needsConsent: boolean }> {
  const config = authConfig();
  if (!config) throw new Error("login unavailable");
  const response = await (await client(config)).processSigninResponse(url);
  const { sub } = accept(response, null);
  return { sub, needsConsent: !hasConsent(sub) };
}

export function getSession(): Promise<Session | null> {
  const config = authConfig();
  const stored = readStored();
  if (!config || !stored) {
    session = null;
    return Promise.resolve(null);
  }
  if (session && session.sub === stored.sub && session.expiresAt - REFRESH_MARGIN_SECONDS > nowSeconds()) {
    return Promise.resolve(session);
  }
  if (!refreshing) {
    const pending: Promise<Session | null> = refresh(config, stored).finally(() => {
      // 로그아웃 뒤 새로 시작된 갱신을 지우지 않게, 자기 것일 때만.
      if (refreshing === pending) refreshing = null;
    });
    refreshing = pending;
  }
  return refreshing;
}

async function refresh(config: AuthConfig, stored: StoredAuth): Promise<Session | null> {
  const startedAt = generation;
  const { ErrorResponse } = await import("oidc-client-ts");
  // RefreshState 는 타입 선언에만 있고 런타임에는 내보내지 않는다(3.5.0) — 같은 모양의 값을 넘긴다.
  // 갱신 응답에 id_token 이 있으면 그 sub 가, 없으면 여기 profile 이 response.profile 이 된다.
  const state: RefreshState = {
    refresh_token: stored.refreshToken,
    session_state: null,
    profile: { sub: stored.sub } as UserProfile,
  };
  try {
    const response = await (await client(config)).useRefreshToken({ state });
    if (generation !== startedAt) return null;
    if (response.profile.sub !== stored.sub) {
      forgetLogin();
      return null;
    }
    return accept(response, stored.refreshToken);
  } catch (err) {
    // 서버가 거절했다(만료·취소·탈퇴한 사용자). 네트워크 실패는 그대로 던진다 — 기록을 지우면 안 된다.
    if (generation !== startedAt) return null;
    if (err instanceof ErrorResponse) {
      forgetLogin();
      return null;
    }
    throw err;
  }
}

function forgetLogin(): void {
  generation++;
  session = null;
  refreshing = null;
  writeStored(null);
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // 무시
  }
  emit();
}

/**
 * 이 기기의 로그인 기록을 지운다. 기본은 Cognito /logout 으로 보내 Hosted UI 세션 쿠키도 끊는다
 * (공용 PC). 도착지 "/" 는 layout 스크립트가 온보딩으로 보낸다.
 * 이 함수는 답(사본)을 지우지 않는다 — 그건 lib/sync.ts 의 logout·withdraw 가 정한다.
 */
export function signOut({ redirect = true }: { redirect?: boolean } = {}): void {
  const config = authConfig();
  forgetLogin();
  if (redirect && config) {
    const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `${window.location.origin}/` });
    goTo(`https://${config.domain}/logout?${params.toString()}`);
  }
}

// ── 동의 기록 (기기마다. 서버에 묻는 것 자체가 "동의 전 서버 호출"이라 이 기기에 둔다) ──

interface ConsentRecord {
  sub: string;
  version: string;
  at: string;
}

function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ConsentRecord>;
    return typeof value.sub === "string" && typeof value.version === "string" && typeof value.at === "string"
      ? { sub: value.sub, version: value.version, at: value.at }
      : null;
  } catch {
    return null;
  }
}

export function hasConsent(sub: string): boolean {
  const record = readConsent();
  return record !== null && record.sub === sub && record.version === CONSENT_VERSION;
}

export function recordConsent(sub: string, now: Date = new Date()): string {
  const at = now.toISOString();
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ sub, version: CONSENT_VERSION, at }));
  } catch {
    // 못 적으면 다음 로그인 때 동의 화면을 다시 본다.
  }
  return at;
}

export function consentAtFor(sub: string): string | null {
  return hasConsent(sub) ? (readConsent()?.at ?? null) : null;
}

export function forgetConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // 무시
  }
}

/** 테스트 전용 — 모듈 안의 메모리 상태를 처음으로. */
export function resetAuthForTests(): void {
  session = null;
  refreshing = null;
  clientPromise = null;
  clientKey = "";
  listeners.clear();
}
