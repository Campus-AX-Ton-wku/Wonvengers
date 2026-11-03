import { describe, expect, it, vi } from "vitest";
import { route, type Deps } from "../src/app";
import type { AccountService } from "../src/cognito";
import { KakaoUnlinkError, type KakaoUnlinker } from "../src/kakao";
import type { LogEntry } from "../src/log";
import type { PutOutcome, StoredItem, UserDataStore } from "../src/store";
import type { UserDataPayload } from "../../web/lib/user-data";
import { A, B, apiEvent, validPayload } from "./fixtures";

/** DynamoDB 조건부 쓰기와 같은 규칙의 메모리 저장소. */
class MemoryStore implements UserDataStore {
  readonly items = new Map<string, StoredItem>();
  constructor(private readonly calls: string[]) {}
  async get(userId: string) {
    return this.items.get(userId) ?? null;
  }
  async put(userId: string, data: UserDataPayload, base: string | null, now: Date): Promise<PutOutcome> {
    const current = this.items.get(userId);
    if (base === null ? current !== undefined : current?.updatedAt !== base) return { ok: false, reason: "conflict" };
    const updatedAt = now.toISOString();
    this.items.set(userId, { data, updatedAt });
    return { ok: true, updatedAt };
  }
  async delete(userId: string) {
    this.calls.push(`store.delete:${userId}`);
    this.items.delete(userId);
  }
}

function setup(kakaoImpl?: KakaoUnlinker["unlink"]) {
  const calls: string[] = [];
  const logs: LogEntry[] = [];
  const store = new MemoryStore(calls);
  const accounts: AccountService = {
    kakaoUserId: vi.fn(async (username: string) => {
      calls.push(`kakaoUserId:${username}`);
      return username.replace("kakao_", "");
    }),
    deleteUser: vi.fn(async (username: string) => {
      calls.push(`deleteUser:${username}`);
    }),
  };
  const kakao: KakaoUnlinker = {
    unlink: vi.fn(
      kakaoImpl ??
        (async (id: string) => {
          calls.push(`unlink:${id}`);
          return "unlinked" as const;
        })
    ),
  };
  let second = 0;
  const deps: Deps = {
    store,
    accounts,
    kakao,
    now: () => new Date(Date.UTC(2026, 10, 4, 9, 0, second++)),
    log: (entry) => logs.push(entry),
  };
  return { deps, store, calls, logs, accounts, kakao };
}

const put = (claims: Record<string, string> | null, body: unknown, opts: { raw?: string; base64?: boolean } = {}) =>
  apiEvent("PUT /me/data", claims, body, opts);

describe("GET·PUT /me/data", () => {
  it("항목이 없으면 204", async () => {
    const { deps } = setup();
    const res = await route(apiEvent("GET /me/data", A), deps);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBeUndefined();
  });

  it("저장하면 200 { updatedAt }, 읽으면 200 { data, updatedAt }", async () => {
    const { deps } = setup();
    const saved = await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    expect(saved.statusCode).toBe(200);
    const { updatedAt } = JSON.parse(saved.body!) as { updatedAt: string };
    expect(updatedAt).toBe("2026-11-04T09:00:00.000Z");

    const read = await route(apiEvent("GET /me/data", A), deps);
    expect(read.statusCode).toBe(200);
    expect(JSON.parse(read.body!)).toEqual({ data: validPayload(), updatedAt });
  });

  it("authorizer 를 거친 sub 가 없으면 401 이고 저장소를 건드리지 않는다", async () => {
    const { deps, store } = setup();
    const res = await route(put(null, { data: validPayload(), baseUpdatedAt: null }), deps);
    expect(res.statusCode).toBe(401);
    expect(store.items.size).toBe(0);
  });
});

describe("남의 데이터 차단 — 사용자 ID 는 토큰 sub 에서만", () => {
  it("B 의 토큰으로는 A 의 항목을 읽을 수 없다 — 쿼리에 A 를 적어도", async () => {
    const { deps } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(apiEvent("GET /me/data", B, undefined, { query: `userId=${A.sub}` }), deps);
    expect(res.statusCode).toBe(204);
  });

  it("B 가 저장하면 B 의 항목이 생기고 A 의 항목은 그대로다", async () => {
    const { deps, store } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const before = store.items.get(A.sub);
    await route(put(B, { data: validPayload({ listing: null }), baseUpdatedAt: null }), deps);
    expect(store.items.get(A.sub)).toEqual(before);
    expect(store.items.get(B.sub)?.data.listing).toBeNull();
  });

  it("본문에 userId 를 넣으면 400 — 다른 사람 자리에 쓸 길이 없다", async () => {
    const { deps, store } = setup();
    const res = await route(put(B, { data: { ...validPayload(), userId: A.sub }, baseUpdatedAt: null }), deps);
    expect(res.statusCode).toBe(400);
    expect(store.items.size).toBe(0);
  });

  it("B 가 탈퇴해도 A 의 항목은 남는다", async () => {
    const { deps, store } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    await route(put(B, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(apiEvent("DELETE /me", B), deps);
    expect(res.statusCode).toBe(204);
    expect(store.items.has(A.sub)).toBe(true);
    expect(store.items.has(B.sub)).toBe(false);
  });
});

describe("크기·형식", () => {
  it("64KB 를 넘으면 413", async () => {
    const { deps, store } = setup();
    const res = await route(put(A, undefined, { raw: "x".repeat(65_537) }), deps);
    expect(res.statusCode).toBe(413);
    expect(store.items.size).toBe(0);
  });

  it("글자 수가 아니라 바이트로 센다 — 한글 22,000자(66,000바이트)는 413", async () => {
    const { deps } = setup();
    const res = await route(put(A, undefined, { raw: "가".repeat(22_000) }), deps);
    expect(res.statusCode).toBe(413);
  });

  it("base64 로 온 본문도 풀어서 읽는다", async () => {
    const { deps } = setup();
    const res = await route(put(A, { data: validPayload(), baseUpdatedAt: null }, { base64: true }), deps);
    expect(res.statusCode).toBe(200);
  });

  it("JSON 이 아니면 400 invalid_json", async () => {
    const { deps } = setup();
    const res = await route(put(A, undefined, { raw: "{" }), deps);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!)).toEqual({ error: "invalid_json" });
  });

  it("형식이 틀리면 400 과 경로", async () => {
    const { deps } = setup();
    const res = await route(put(A, { data: { ...validPayload(), schemaVersion: 2 }, baseUpdatedAt: null }), deps);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!)).toEqual({ error: "invalid", path: "body.data.schemaVersion: unsupported version" });
  });
});

describe("낙관적 동시성 — 409", () => {
  it("서버 항목이 있는데 baseUpdatedAt 이 null 이면 409", async () => {
    const { deps } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body!)).toEqual({ error: "conflict" });
  });

  it("오래된 baseUpdatedAt 이면 409, 지금 값이면 200", async () => {
    const { deps } = setup();
    const first = JSON.parse((await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps)).body!);
    const second = JSON.parse(
      (await route(put(A, { data: validPayload({ listing: null }), baseUpdatedAt: first.updatedAt }), deps)).body!
    );
    const stale = await route(put(A, { data: validPayload(), baseUpdatedAt: first.updatedAt }), deps);
    expect(stale.statusCode).toBe(409);
    const fresh = await route(put(A, { data: validPayload(), baseUpdatedAt: second.updatedAt }), deps);
    expect(fresh.statusCode).toBe(200);
  });
});

describe("DELETE /me — 회원 탈퇴 순서", () => {
  it("카카오 연결 끊기 → 내 항목 삭제 → Cognito 사용자 삭제", async () => {
    const { deps, calls } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(apiEvent("DELETE /me", A), deps);
    expect(res.statusCode).toBe(204);
    expect(calls).toEqual([
      "kakaoUserId:kakao_1001",
      "unlink:1001",
      `store.delete:${A.sub}`,
      "deleteUser:kakao_1001",
    ]);
  });

  it("카카오 끊기가 실패하면 500 이고 DB·Cognito 는 그대로다", async () => {
    const { deps, store, accounts, logs } = setup(async () => {
      throw new KakaoUnlinkError(500, -1);
    });
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(apiEvent("DELETE /me", A), deps);
    expect(res.statusCode).toBe(500);
    expect(store.items.has(A.sub)).toBe(true);
    expect(accounts.deleteUser).not.toHaveBeenCalled();
    expect(logs.at(-1)).toMatchObject({ route: "DELETE /me", status: 500, reason: "KakaoUnlinkError" });
  });

  it("카카오에서 이미 끊긴 사용자는 성공으로 보고 계속 지운다", async () => {
    const { deps, store, accounts } = setup(async () => "already" as const);
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    const res = await route(apiEvent("DELETE /me", A), deps);
    expect(res.statusCode).toBe(204);
    expect(store.items.has(A.sub)).toBe(false);
    expect(accounts.deleteUser).toHaveBeenCalledWith("kakao_1001");
  });

  it("토큰에 username 이 없으면 401 이고 아무것도 지우지 않는다", async () => {
    const { deps, kakao } = setup();
    const res = await route(apiEvent("DELETE /me", { sub: A.sub }), deps);
    expect(res.statusCode).toBe(401);
    expect(kakao.unlink).not.toHaveBeenCalled();
  });
});

describe("로그", () => {
  it("사용자 데이터 값과 sub 를 남기지 않는다 — sub 의 해시와 결과 코드만", async () => {
    const { deps, logs } = setup();
    await route(put(A, { data: validPayload(), baseUpdatedAt: null }), deps);
    await route(apiEvent("GET /me/data", A), deps);
    const text = JSON.stringify(logs);
    for (const value of ["익산", "2002-03-14", "900000", A.sub, "kakao_1001"]) expect(text).not.toContain(value);
    expect(logs).toEqual([
      { route: "PUT /me/data", user: expect.stringMatching(/^[0-9a-f]{16}$/), status: 200 },
      { route: "GET /me/data", user: logs[0].user, status: 200 },
    ]);
  });

  it("모르는 경로는 404", async () => {
    const { deps } = setup();
    expect((await route(apiEvent("POST /me/data", A), deps)).statusCode).toBe(404);
  });
});
