import { describe, expect, it, vi } from "vitest";
import { KAKAO_UNLINK_PATH, isKakaoUnlinkRoute, kakaoUnlinkWebhook, type WebhookDeps } from "../src/kakao-webhook";
import type { LogEntry } from "../src/log";
import { hashUserId } from "../src/log";
import { A, apiEvent } from "./fixtures";

/**
 * 카카오 연결 해제 웹훅 (11/20, docs/기획/2026-11-04-카카오-로그인-배포-체크리스트.md).
 * 이용자가 카카오 쪽에서 Perky 연결을 끊으면(카카오계정 탈퇴 · 연결된 서비스 관리) 카카오가 알려 준다.
 * 사양(developers.kakao.com/docs/ko/kakaologin/callback): GET 또는 POST, 헤더 `Authorization: KakaoAK {대표 어드민 키}`,
 * 파라미터 app_id · user_id(회원번호) · referrer_type. 3초 안에 200 — 사용자 정보가 없거나 오류가 나도 200.
 */
const ADMIN_KEY = "admin-key-for-test";

function setup(over: Partial<WebhookDeps> = {}) {
  const calls: string[] = [];
  const logs: LogEntry[] = [];
  const deps: WebhookDeps = {
    kakaoAdminKey: async () => ADMIN_KEY,
    accounts: {
      findByKakaoId: vi.fn(async (id: string) => {
        calls.push(`find:${id}`);
        return id === "1001" ? { username: "Kakao_1001", sub: A.sub } : null;
      }),
      deleteUser: vi.fn(async (username: string) => {
        calls.push(`deleteUser:${username}`);
      }),
    },
    store: {
      delete: vi.fn(async (sub: string) => {
        calls.push(`store.delete:${sub}`);
      }),
    },
    push: {
      deleteAll: vi.fn(async (sub: string) => {
        calls.push(`push.deleteAll:${sub}`);
      }),
    },
    log: (entry) => logs.push(entry),
    ...over,
  };
  return { deps, calls, logs };
}

function webhookEvent(
  method: "GET" | "POST",
  params: Record<string, string>,
  opts: { auth?: string | null; base64?: boolean } = {}
) {
  const form = new URLSearchParams(params).toString();
  const event = apiEvent(
    `${method} ${KAKAO_UNLINK_PATH}`,
    null,
    undefined,
    method === "GET" ? { query: form } : { raw: form, base64: opts.base64 }
  );
  const auth = opts.auth === undefined ? `KakaoAK ${ADMIN_KEY}` : opts.auth;
  event.headers = {
    ...(auth === null ? {} : { authorization: auth }),
    ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
  };
  return event;
}

const PARAMS = { app_id: "123456", user_id: "1001", referrer_type: "UNLINK_FROM_APPS" };

describe("카카오 연결 해제 웹훅", () => {
  it("경로는 GET · POST /kakao/unlink 둘이다", () => {
    expect(isKakaoUnlinkRoute("POST /kakao/unlink")).toBe(true);
    expect(isKakaoUnlinkRoute("GET /kakao/unlink")).toBe(true);
    expect(isKakaoUnlinkRoute("DELETE /me")).toBe(false);
  });

  it("POST 로 오면 그 회원의 답 → 알림 구독 → 로그인 계정 순서로 지우고 200", async () => {
    const { deps, calls, logs } = setup();
    const res = await kakaoUnlinkWebhook(webhookEvent("POST", PARAMS), deps);
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([
      "find:1001",
      `store.delete:${A.sub}`,
      `push.deleteAll:${A.sub}`,
      "deleteUser:Kakao_1001",
    ]);
    // 로그에는 sub 의 해시만 — 회원번호 · sub 를 그대로 남기지 않는다
    expect(logs).toEqual([{ route: "POST /kakao/unlink", user: hashUserId(A.sub), status: 200 }]);
    expect(JSON.stringify(logs)).not.toContain("1001");
  });

  it("GET 쿼리로 와도 같다", async () => {
    const { deps, calls } = setup();
    const res = await kakaoUnlinkWebhook(webhookEvent("GET", PARAMS), deps);
    expect(res.statusCode).toBe(200);
    expect(calls).toContain("deleteUser:Kakao_1001");
  });

  it("base64 로 온 본문도 읽는다", async () => {
    const { deps, calls } = setup();
    await kakaoUnlinkWebhook(webhookEvent("POST", PARAMS, { base64: true }), deps);
    expect(calls).toContain(`store.delete:${A.sub}`);
  });

  it("어드민 키가 없거나 다르면 401 이고 아무것도 찾거나 지우지 않는다 — 누구나 부를 수 있는 주소다", async () => {
    for (const auth of [null, "KakaoAK wrong-key", `Bearer ${ADMIN_KEY}`, ADMIN_KEY, `KakaoAK ${ADMIN_KEY}x`]) {
      const { deps, calls, logs } = setup();
      const res = await kakaoUnlinkWebhook(webhookEvent("POST", PARAMS, { auth }), deps);
      expect(res.statusCode).toBe(401);
      expect(calls).toEqual([]);
      expect(logs.at(-1)).toMatchObject({ route: "POST /kakao/unlink", user: "-", status: 401 });
    }
  });

  it("우리 쪽에 없는 회원이면 아무것도 지우지 않고 200 (카카오 사양: 사용자 정보가 없어도 200)", async () => {
    const { deps, calls, logs } = setup();
    const res = await kakaoUnlinkWebhook(webhookEvent("POST", { ...PARAMS, user_id: "9999" }), deps);
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(["find:9999"]);
    expect(logs.at(-1)).toMatchObject({ status: 200, user: "-", reason: "no_user" });
  });

  it("회원번호가 없거나 숫자가 아니면 아무것도 하지 않고 200", async () => {
    for (const user_id of ["", "abc", "1001; drop", "1".repeat(30)]) {
      const { deps, calls, logs } = setup();
      const res = await kakaoUnlinkWebhook(webhookEvent("POST", { ...PARAMS, user_id }), deps);
      expect(res.statusCode).toBe(200);
      expect(calls).toEqual([]);
      expect(logs.at(-1)).toMatchObject({ reason: "invalid_params" });
    }
  });

  it("지우다 오류가 나도 200 — 카카오 사양. 대신 오류 이름을 로그에 남긴다", async () => {
    const failing = new Error("boom");
    failing.name = "ProvisionedThroughputExceededException";
    const { deps, calls, logs } = setup({
      push: {
        deleteAll: vi.fn(async () => {
          throw failing;
        }),
      },
    });
    const res = await kakaoUnlinkWebhook(webhookEvent("POST", PARAMS), deps);
    expect(res.statusCode).toBe(200);
    // 로그인 계정은 지우지 않는다 — 남아 있어야 다음에 다시 지울 근거(회원번호)가 남는다
    expect(calls).not.toContain("deleteUser:Kakao_1001");
    expect(logs.at(-1)).toMatchObject({ status: 200, reason: "ProvisionedThroughputExceededException" });
  });

  it("어드민 키를 못 읽으면 500 — 카카오 요청인지 확인할 수 없다", async () => {
    const { deps, calls } = setup({
      kakaoAdminKey: async () => {
        throw new Error("ssm down");
      },
    });
    const res = await kakaoUnlinkWebhook(webhookEvent("POST", PARAMS), deps);
    expect(res.statusCode).toBe(500);
    expect(calls).toEqual([]);
  });

  it("본문이 4KB 를 넘으면 413 이고 아무것도 하지 않는다", async () => {
    const { deps, calls } = setup();
    const res = await kakaoUnlinkWebhook(webhookEvent("POST", { ...PARAMS, pad: "x".repeat(5000) }), deps);
    expect(res.statusCode).toBe(413);
    expect(calls).toEqual([]);
  });
});
