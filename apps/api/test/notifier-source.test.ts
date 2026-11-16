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
