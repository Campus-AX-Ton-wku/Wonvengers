import { describe, expect, it, vi } from "vitest";
import { fetchPublishedPolicies } from "../src/notifier/source";
import { policy } from "./fixtures";

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("fetchPublishedPolicies — 배포된 앱의 /policies.json", () => {
  it("정책 배열을 돌려준다", async () => {
    const f = respond(200, [policy({ id: "a" })]);
    expect((await fetchPublishedPolicies("https://site/policies.json", f)).map((p) => p.id)).toEqual(["a"]);
    expect(f).toHaveBeenCalledWith("https://site/policies.json", expect.objectContaining({ signal: expect.anything() }));
  });

  it("200 이 아니면 던진다", async () => {
    await expect(fetchPublishedPolicies("u", respond(503, {}))).rejects.toThrow(/503/);
  });

  it("배열이 아니거나 id · name · discovery 가 없는 항목이 있으면 던진다", async () => {
    await expect(fetchPublishedPolicies("u", respond(200, { a: 1 }))).rejects.toThrow();
    await expect(fetchPublishedPolicies("u", respond(200, [{ id: "a" }]))).rejects.toThrow();
  });
});

import { fetchPublishedNotices } from "../src/notifier/source";

describe("fetchPublishedNotices — 배포된 /notices.json", () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
  it("공고 목록을 돌려준다", async () => {
    const n = { id: "myhome:1", title: "t", kind: "공공임대", url: "https://x" };
    expect(await fetchPublishedNotices("https://app/notices.json", ok({ generatedAt: null, notices: [n] }))).toEqual([n]);
  });
  it("모양이 틀리면 던진다(그 회차 공고 알림만 건너뛴다)", async () => {
    await expect(fetchPublishedNotices("u", ok([]))).rejects.toThrow();
    await expect(fetchPublishedNotices("u", ok({ notices: [{ id: 1 }] }))).rejects.toThrow();
  });
});
