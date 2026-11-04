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

/**
 * 한 요청(토큰 확인 · fetch · 본문 읽기)의 상한. 넘으면 요청을 끊고 RemoteError(408).
 * 로그아웃이 남은 쓰기를 올려 보다가 영원히 기다리면 공용 PC 의 사본이 지워지지 않는다.
 */
export const REMOTE_TIMEOUT_MS = 8000;

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RemoteError(408));
    }, REMOTE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function call(
  signal: AbortSignal,
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<Response> {
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
    signal,
  });
}

export function loadRemote(): Promise<GetResponseBody | null> {
  return withTimeout(async (signal) => {
    const res = await call(signal, "GET", "/me/data");
    if (res.status === 204) return null;
    if (!res.ok) throw new RemoteError(res.status);
    const body = (await res.json()) as { data?: unknown; updatedAt?: unknown };
    const checked = validateUserData(body.data);
    if (!checked.ok || typeof body.updatedAt !== "string") throw new RemoteError(502);
    return { data: checked.value, updatedAt: body.updatedAt };
  });
}

export function saveRemote(data: UserDataPayload, baseUpdatedAt: string | null): Promise<SaveResult> {
  return withTimeout(async (signal): Promise<SaveResult> => {
    const res = await call(signal, "PUT", "/me/data", { data, baseUpdatedAt });
    if (res.status === 409) return { ok: false, conflict: true };
    if (!res.ok) throw new RemoteError(res.status);
    const body = (await res.json()) as PutResponseBody;
    return { ok: true, updatedAt: body.updatedAt };
  });
}

export function deleteAccountRemote(): Promise<void> {
  return withTimeout(async (signal) => {
    const res = await call(signal, "DELETE", "/me");
    if (res.status !== 204) throw new RemoteError(res.status);
  });
}
