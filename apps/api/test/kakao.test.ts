import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { KAKAO_UNLINK_URL, KakaoUnlinkError, ssmAdminKeyLoader, unlinkKakaoUser } from "../src/kakao";

const ssm = mockClient(SSMClient);
beforeEach(() => ssm.reset());

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("unlinkKakaoUser", () => {
  it("Admin 키로 회원번호의 연결을 끊는다", async () => {
    const fetchImpl = respond(200, { id: 1001 });
    expect(await unlinkKakaoUser("1001", "admin-key-test", fetchImpl)).toBe("unlinked");
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(KAKAO_UNLINK_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("KakaoAK admin-key-test");
    expect(init.body).toBe("target_id_type=user_id&target_id=1001");
  });

  it("이미 끊긴 사용자(-101)는 성공으로 본다", async () => {
    expect(await unlinkKakaoUser("1001", "k", respond(400, { code: -101, msg: "NotRegisteredUser" }))).toBe("already");
  });

  it("다른 오류는 던진다", async () => {
    await expect(unlinkKakaoUser("1001", "k", respond(401, { code: -401 }))).rejects.toBeInstanceOf(KakaoUnlinkError);
    const notJson = vi.fn(async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch;
    await expect(unlinkKakaoUser("1001", "k", notJson)).rejects.toBeInstanceOf(KakaoUnlinkError);
  });
});

describe("ssmAdminKeyLoader", () => {
  it("복호화해서 읽고, 두 번째부터는 다시 묻지 않는다", async () => {
    ssm.on(GetParameterCommand).resolves({ Parameter: { Value: "admin-key-test" } });
    const load = ssmAdminKeyLoader(new SSMClient({ region: "ap-northeast-2" }), "/perky/kakao/admin-key");
    expect(await load()).toBe("admin-key-test");
    expect(await load()).toBe("admin-key-test");
    expect(ssm.commandCalls(GetParameterCommand)).toHaveLength(1);
    expect(ssm.commandCalls(GetParameterCommand)[0].args[0].input).toEqual({
      Name: "/perky/kakao/admin-key",
      WithDecryption: true,
    });
  });

  it("실패는 기억하지 않는다 — 다음 호출이 다시 읽는다", async () => {
    ssm.on(GetParameterCommand).rejectsOnce(new Error("throttled")).resolves({ Parameter: { Value: "k" } });
    const load = ssmAdminKeyLoader(new SSMClient({ region: "ap-northeast-2" }), "/perky/kakao/admin-key");
    await expect(load()).rejects.toThrow("throttled");
    expect(await load()).toBe("k");
  });
});
