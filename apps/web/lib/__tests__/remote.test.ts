// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { REMOTE_TIMEOUT_MS, RemoteError, deleteAccountRemote, loadRemote, saveRemote } from "@/lib/remote";
import { CONSENT_VERSION, SCHEMA_VERSION, emptyContent, type UserDataPayload } from "@/lib/user-data";
import { enableLogin } from "./auth-fixtures";

const fetchMock = vi.fn<typeof fetch>();
const payload: UserDataPayload = {
  ...emptyContent(),
  schemaVersion: SCHEMA_VERSION,
  consentVersion: CONSENT_VERSION,
  consentAt: "2026-11-04T09:00:00.000Z",
};

beforeEach(() => {
  enableLogin();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(getSession).mockResolvedValue({ accessToken: "at-1", sub: "sub-a", expiresAt: 9_999_999_999 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("lib/remote", () => {
  it("GET /me/data 에 Bearer access 토큰을 붙이고, 204 면 null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await loadRemote()).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.example/me/data");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
  });

  it("200 이면 { data, updatedAt } — 형식이 틀린 응답은 받지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: payload, updatedAt: "2026-11-04T10:00:00.000Z" }));
    expect(await loadRemote()).toEqual({ data: payload, updatedAt: "2026-11-04T10:00:00.000Z" });
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ...payload, extra: 1 }, updatedAt: "x" }));
    await expect(loadRemote()).rejects.toBeInstanceOf(RemoteError);
  });

  it("PUT 본문은 { data, baseUpdatedAt } JSON, 200 이면 새 시각", async () => {
    fetchMock.mockResolvedValue(Response.json({ updatedAt: "2026-11-04T10:00:01.000Z" }));
    expect(await saveRemote(payload, "2026-11-04T10:00:00.000Z")).toEqual({
      ok: true,
      updatedAt: "2026-11-04T10:00:01.000Z",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ data: payload, baseUpdatedAt: "2026-11-04T10:00:00.000Z" });
  });

  it("409 는 충돌, 그 밖의 실패는 RemoteError", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "conflict" }, { status: 409 }));
    expect(await saveRemote(payload, null)).toEqual({ ok: false, conflict: true });
    fetchMock.mockResolvedValueOnce(Response.json({ error: "internal" }, { status: 500 }));
    await expect(saveRemote(payload, null)).rejects.toMatchObject({ status: 500 });
  });

  it("세션이 없으면 부르지 않고 401", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(loadRemote()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DELETE /me 는 204 만 성공", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteAccountRemote();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test.example/me");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    fetchMock.mockResolvedValueOnce(Response.json({ error: "internal" }, { status: 500 }));
    await expect(deleteAccountRemote()).rejects.toBeInstanceOf(RemoteError);
  });

  it("응답이 오지 않으면 8초 뒤 요청을 끊고 RemoteError — 로그아웃이 영원히 기다리지 않게", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const pending = saveRemote(payload, null);
    const settled = pending.then(
      () => "resolved",
      (err: unknown) => err
    );
    await vi.advanceTimersByTimeAsync(REMOTE_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await settled;
    expect(err).toBeInstanceOf(RemoteError);
    expect(signal?.aborted).toBe(true);
  });
});

