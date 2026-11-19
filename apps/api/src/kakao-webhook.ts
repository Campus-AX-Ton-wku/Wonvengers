import { timingSafeEqual } from "node:crypto";
import type { KakaoAccountLookup } from "./cognito";
import { bodyBytes, type ApiEvent, type ApiResult } from "./http";
import { hashUserId, type LogEntry } from "./log";
import type { PushStore } from "./push-store";
import type { UserDataStore } from "./store";

/**
 * 카카오 연결 해제 웹훅 (11/20).
 *
 * 이용자가 Perky 밖에서 연결을 끊으면(카카오계정 탈퇴 · 카카오계정 › 연결된 서비스 관리) 카카오가 이 주소로 알려 준다.
 * 예전에는 그런 사람의 답이 마지막 저장 후 1년(TTL)까지 남았다. 이제 받는 즉시 지운다 — 앱 안 회원 탈퇴(DELETE /me)와
 * 같은 순서(답 → 알림 구독 → 로그인 계정)에서 카카오 끊기만 뺐다(이미 끊겼다).
 *
 * 사양 — developers.kakao.com/docs/ko/kakaologin/callback '연결 해제 웹훅' (11/20 확인):
 * - GET 또는 POST. 파라미터 app_id · user_id(회원번호) · referrer_type
 * - 헤더 `Authorization: KakaoAK {대표 어드민 키}` — 카카오 요청인지 확인할 수단은 이것 하나다
 * - 3초 안에 200. 사용자 정보가 없거나 오류가 나도 200
 * - Perky 가 연결 해제 API 를 직접 부른 경우(앱 안 회원 탈퇴)에는 오지 않는다
 *
 * JWT authorizer 뒤에 있지 않은 유일한 경로다 — 누구나 부를 수 있으니 어드민 키를 먼저 본다.
 */
export const KAKAO_UNLINK_PATH = "/kakao/unlink";
const ROUTES = new Set([`GET ${KAKAO_UNLINK_PATH}`, `POST ${KAKAO_UNLINK_PATH}`]);
const MAX_BODY_BYTES = 4096;
/** 카카오 회원번호는 Long — 숫자만, 19자리까지 */
const KAKAO_USER_ID = /^\d{1,19}$/;

export function isKakaoUnlinkRoute(routeKey: string): boolean {
  return ROUTES.has(routeKey);
}

export interface WebhookDeps {
  kakaoAdminKey: () => Promise<string>;
  accounts: KakaoAccountLookup;
  store: Pick<UserDataStore, "delete">;
  push: Pick<PushStore, "deleteAll">;
  log: (entry: LogEntry) => void;
}

export async function kakaoUnlinkWebhook(event: ApiEvent, deps: WebhookDeps): Promise<ApiResult> {
  const route = event.routeKey;
  const done = (statusCode: number, user = "-", reason?: string): ApiResult => {
    deps.log({ route, user, status: statusCode, ...(reason ? { reason } : {}) });
    return { statusCode };
  };

  let adminKey: string;
  try {
    adminKey = await deps.kakaoAdminKey();
  } catch (err) {
    return done(500, "-", err instanceof Error ? err.name : "unknown");
  }
  if (!sameSecret(header(event, "authorization"), `KakaoAK ${adminKey}`)) return done(401);

  const bytes = bodyBytes(event);
  if (bytes.length > MAX_BODY_BYTES) return done(413);
  const params = new URLSearchParams(event.rawQueryString ?? "");
  if (bytes.length > 0) for (const [k, v] of new URLSearchParams(bytes.toString("utf8"))) params.set(k, v);
  const kakaoUserId = params.get("user_id") ?? "";
  if (!KAKAO_USER_ID.test(kakaoUserId)) return done(200, "-", "invalid_params");

  let user = "-";
  try {
    const account = await deps.accounts.findByKakaoId(kakaoUserId);
    if (account === null) return done(200, "-", "no_user");
    user = hashUserId(account.sub);
    // 로그인 계정은 맨 마지막 — 앞에서 실패하면 계정이 남아 다음 시도(또는 앱 안 탈퇴)의 근거가 된다
    await deps.store.delete(account.sub);
    await deps.push.deleteAll(account.sub);
    await deps.accounts.deleteUser(account.username);
    return done(200, user);
  } catch (err) {
    // 카카오 사양: 오류가 나도 200. 지우지 못한 답은 TTL(마지막 저장 후 1년)로 사라진다 — 로그에 남겨 손으로 지운다.
    return done(200, user, err instanceof Error ? err.name : "unknown");
  }
}

/** HTTP API(페이로드 2.0)는 헤더 이름을 소문자로 준다. 혹시 몰라 대소문자를 가리지 않고 찾는다. */
function header(event: ApiEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === name) return v;
  return undefined;
}

/** 걸린 시간으로 키를 짐작하지 못하게 — 길이가 다르면 바로 false, 같으면 timingSafeEqual */
function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
