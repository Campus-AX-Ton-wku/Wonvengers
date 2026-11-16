import { MAX_BODY_BYTES, validatePutRequest } from "../../web/lib/user-data";
import { MAX_PUSH_BODY_BYTES, validatePushEndpoint, validatePushSubscription } from "../../web/lib/push-subscription";
import type { AccountService } from "./cognito";
import { bodyBytes, json, type ApiEvent, type ApiResult } from "./http";
import type { KakaoUnlinker } from "./kakao";
import { hashUserId, type LogEntry } from "./log";
import type { PushStore } from "./push-store";
import type { UserDataStore } from "./store";

export interface Deps {
  store: UserDataStore;
  push: PushStore;
  accounts: AccountService;
  kakao: KakaoUnlinker;
  now: () => Date;
  log: (entry: LogEntry) => void;
}

/**
 * 다섯 경로 (설계 "API"). JWT authorizer 가 발급자·audience 를 이미 검증했다.
 * 사용자 ID 는 그 토큰의 sub 에서만 꺼낸다 — 본문·경로·쿼리는 보지 않는다.
 */
export async function route(event: ApiEvent, deps: Deps): Promise<ApiResult> {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const sub = typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : null;
  const key = event.routeKey;
  if (sub === null) return finish(deps, key, "-", json(401, { error: "unauthorized" }));
  const user = hashUserId(sub);

  try {
    switch (key) {
      case "GET /me/data":
        return finish(deps, key, user, await getData(sub, deps));
      case "PUT /me/data":
        return finish(deps, key, user, await putData(sub, event, deps));
      case "PUT /me/push":
        return finish(deps, key, user, await putPush(sub, event, deps));
      case "DELETE /me/push":
        return finish(deps, key, user, await deletePush(sub, event, deps));
      case "DELETE /me": {
        const username = typeof claims.username === "string" && claims.username !== "" ? claims.username : null;
        if (username === null) return finish(deps, key, user, json(401, { error: "unauthorized" }));
        return finish(deps, key, user, await deleteMe(sub, username, deps));
      }
      default:
        return finish(deps, key, user, json(404, { error: "not_found" }));
    }
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    return finish(deps, key, user, json(500, { error: "internal" }), reason);
  }
}

function finish(deps: Deps, route: string, user: string, result: ApiResult, reason?: string): ApiResult {
  deps.log({ route, user, status: result.statusCode ?? 500, ...(reason ? { reason } : {}) });
  return result;
}

async function getData(sub: string, deps: Deps): Promise<ApiResult> {
  const item = await deps.store.get(sub);
  return item === null ? json(204) : json(200, { data: item.data, updatedAt: item.updatedAt });
}

async function putData(sub: string, event: ApiEvent, deps: Deps): Promise<ApiResult> {
  const bytes = bodyBytes(event);
  if (bytes.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const checked = validatePutRequest(parsed);
  if (!checked.ok) return json(400, { error: "invalid", path: checked.error });
  const outcome = await deps.store.put(sub, checked.value.data, checked.value.baseUpdatedAt, deps.now());
  if (!outcome.ok) return json(409, { error: "conflict" });
  return json(200, { updatedAt: outcome.updatedAt });
}

/**
 * 회원 탈퇴. 순서가 중요하다 — DB·Cognito 를 먼저 지우면 다시 시도할 근거(카카오 회원번호)가
 * 사라진다. 카카오 끊기가 던지면 아래 세 호출(DB · 푸시 구독 · Cognito)은 실행되지 않고 500 이 된다.
 * 푸시 구독(push.deleteAll)은 Cognito 보다 먼저 지운다 — 사용자를 먼저 지우면 구독 행이 주인 없이 남고 알림이 계속 간다.
 */
async function deleteMe(sub: string, username: string, deps: Deps): Promise<ApiResult> {
  const kakaoUserId = await deps.accounts.kakaoUserId(username, sub);
  await deps.kakao.unlink(kakaoUserId);
  await deps.store.delete(sub);
  await deps.push.deleteAll(sub);
  await deps.accounts.deleteUser(username);
  return json(204);
}

/** 본문을 JSON 으로. 크기를 먼저 본다. 실패하면 응답을 돌려준다. */
function readJson(event: ApiEvent, maxBytes: number): { ok: true; value: unknown } | { ok: false; result: ApiResult } {
  const bytes = bodyBytes(event);
  if (bytes.length > maxBytes) return { ok: false, result: json(413, { error: "too_large" }) };
  try {
    return { ok: true, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    return { ok: false, result: json(400, { error: "invalid_json" }) };
  }
}

/** 알림 켜기 · 갱신 (설계 "API"). 사용자는 토큰 sub 로만 정한다. */
async function putPush(sub: string, event: ApiEvent, deps: Deps): Promise<ApiResult> {
  const body = readJson(event, MAX_PUSH_BODY_BYTES);
  if (!body.ok) return body.result;
  const checked = validatePushSubscription(body.value);
  if (!checked.ok) return json(400, { error: "invalid", path: checked.error });
  await deps.push.put(sub, checked.value, deps.now());
  return json(204);
}

/** 알림 끄기 — 이 기기 하나. 없어도 204. */
async function deletePush(sub: string, event: ApiEvent, deps: Deps): Promise<ApiResult> {
  const body = readJson(event, MAX_PUSH_BODY_BYTES);
  if (!body.ok) return body.result;
  const checked = validatePushEndpoint(body.value);
  if (!checked.ok) return json(400, { error: "invalid", path: checked.error });
  await deps.push.delete(sub, checked.value.endpoint);
  return json(204);
}
