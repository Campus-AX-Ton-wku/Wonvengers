// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { loadKakaoMaps, resetKakaoMapsForTest } from "@/lib/kakao-map";

afterEach(() => {
  resetKakaoMapsForTest();
  document.head.innerHTML = "";
  delete (window as { kakao?: unknown }).kakao;
});

describe("loadKakaoMaps", () => {
  it("키가 없으면 스크립트를 넣지 않고 바로 실패", async () => {
    await expect(loadKakaoMaps(undefined)).rejects.toThrow("no-key");
    expect(document.querySelector("script")).toBeNull();
  });

  it("autoload=false 로 한 번만 넣고, load 콜백이 오면 kakao.maps 로 풀린다", async () => {
    const p1 = loadKakaoMaps("abc");
    const p2 = loadKakaoMaps("abc");
    const scripts = document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe("https://dapi.kakao.com/v2/maps/sdk.js?appkey=abc&autoload=false");
    const maps = { load: (cb: () => void) => cb() };
    (window as { kakao?: unknown }).kakao = { maps };
    scripts[0].dispatchEvent(new Event("load"));
    await expect(p1).resolves.toBe(maps);
    await expect(p2).resolves.toBe(maps);
  });

  it("스크립트가 실패하면 실패 — 다음에 다시 시도할 수 있다", async () => {
    const p = loadKakaoMaps("abc");
    document.querySelector("script")!.dispatchEvent(new Event("error"));
    await expect(p).rejects.toThrow("load-failed");
    loadKakaoMaps("abc").catch(() => {});
    expect(document.querySelectorAll("script")).toHaveLength(2);
  });

  it("시간 안에 안 오면 실패", async () => {
    await expect(loadKakaoMaps("abc", 10)).rejects.toThrow("timeout");
  });
});
