import { authConfig, getSession } from "./auth";
import { validateUserData, type GetResponseBody, type PutResponseBody, type UserDataPayload } from "./user-data";

/**
 * 답 저장 API 세 개 (설계 "API"). 부르는 쪽은 lib/sync.ts 하나다 — 그쪽이 로그인 + 동의를 확인한다.
 * 사용자 ID 는 보내지 않는다. 서버가 토큰의 sub 로 정한다.
 */
export class RemoteError extends Error {
  constructor(readonly status: number) {
    super(`remote request failed: ${status}`);
    this.name = "RemoteError";
  }
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: true };

async function call(method: "GET" | "PUT" | "DELETE", path: string, body?: unknown): Promise<Response> {
  const config = authConfig();
  const session = await getSession();
  if (!config || !session) throw new RemoteError(401);
  return fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function loadRemote(): Promise<GetResponseBody | null> {
  const res = await call("GET", "/me/data");
  if (res.status === 204) return null;
  if (!res.ok) throw new RemoteError(res.status);
  const body = (await res.json()) as { data?: unknown; updatedAt?: unknown };
  const checked = validateUserData(body.data);
  if (!checked.ok || typeof body.updatedAt !== "string") throw new RemoteError(502);
  return { data: checked.value, updatedAt: body.updatedAt };
}

export async function saveRemote(data: UserDataPayload, baseUpdatedAt: string | null): Promise<SaveResult> {
  const res = await call("PUT", "/me/data", { data, baseUpdatedAt });
  if (res.status === 409) return { ok: false, conflict: true };
  if (!res.ok) throw new RemoteError(res.status);
  const body = (await res.json()) as PutResponseBody;
  return { ok: true, updatedAt: body.updatedAt };
}

export async function deleteAccountRemote(): Promise<void> {
  const res = await call("DELETE", "/me");
  if (res.status !== 204) throw new RemoteError(res.status);
}
