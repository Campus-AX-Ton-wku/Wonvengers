import { describe, expect, it } from "vitest";
import { checkLink, collectLinks } from "../links.mjs";

/**
 * 2026-11-19: 익산 전입 지원 2건의 신청 주소가 404 였다. 보조금24 의 '온라인신청사이트URL'을
 * 그대로 옮겼는데 익산시가 통합예약시스템 주소를 바꿔 옛 주소가 죽었다. 신선도 검사는 공고
 * 내용만 비교해서 못 잡았다 — 사용자가 [공식 사이트로 이동]을 눌러 보고서야 알았다.
 */

const res = (status) => ({ status, ok: status >= 200 && status < 300, body: null });

describe("collectLinks", () => {
  it("같은 주소는 한 번만 열고, 어디에 쓰였는지는 모두 남긴다 · 빈 칸은 건너뛴다", () => {
    const links = collectLinks([
      { name: "가 지원", applyUrl: "https://a.kr/apply", sourceUrl: "https://a.kr/notice", contact: { url: "https://a.kr/notice" } },
      { name: "나 지원", applyUrl: "https://a.kr/apply", sourceUrl: null, contact: null },
    ]);

    expect(links.map((l) => l.url)).toEqual(["https://a.kr/apply", "https://a.kr/notice"]);
    expect(links[0].uses).toEqual([
      { name: "가 지원", field: "신청 주소" },
      { name: "나 지원", field: "신청 주소" },
    ]);
    expect(links[1].uses).toEqual([
      { name: "가 지원", field: "출처" },
      { name: "가 지원", field: "문의처" },
    ]);
  });
});

describe("checkLink", () => {
  it("열리면 정상", async () => {
    expect(await checkLink("https://a.kr", { fetch: async () => res(200), delayMs: 0 })).toMatchObject({ verdict: "ok", status: 200 });
  });

  it("404 · 410 은 깨진 링크 — 다시 시도하지 않는다", async () => {
    let calls = 0;
    const fetch = async () => (calls++, res(404));
    expect(await checkLink("https://a.kr", { fetch, delayMs: 0 })).toMatchObject({ verdict: "broken", status: 404 });
    expect(calls).toBe(1);
    expect(await checkLink("https://a.kr", { fetch: async () => res(410), delayMs: 0 })).toMatchObject({ verdict: "broken" });
  });

  it("연결 실패 · 403 은 '열지 못함' — 해외 서버(GitHub Actions)를 막는 정부 사이트가 있어 깨졌다고 단정하지 않는다", async () => {
    const thrown = await checkLink("https://a.kr", { fetch: async () => { throw new Error("ECONNRESET"); }, delayMs: 0 });
    expect(thrown).toMatchObject({ verdict: "unreachable", status: null });
    expect(thrown.detail).toContain("ECONNRESET");
    expect(await checkLink("https://a.kr", { fetch: async () => res(403), delayMs: 0 })).toMatchObject({ verdict: "unreachable", status: 403 });
  });

  it("5xx 는 한 번 더 열어 본다", async () => {
    let calls = 0;
    const fetch = async () => res(++calls === 1 ? 503 : 200);
    expect(await checkLink("https://a.kr", { fetch, delayMs: 0 })).toMatchObject({ verdict: "ok" });
    expect(calls).toBe(2);
  });
});
