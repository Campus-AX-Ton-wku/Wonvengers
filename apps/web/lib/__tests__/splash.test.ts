import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLE_SPLASH, LAUNCH_PATHS, SPLASH_LAUNCHED_KEY, SPLASH_SCRIPT } from "@/lib/splash";

/** <head> 인라인 스크립트를 가짜 location · matchMedia · navigator · sessionStorage · document 로 돌린다. 띄우면 true */
function run(
  pathname: string,
  { standalone = true, iosStandalone = false, launched = null as string | null, throws = false } = {}
) {
  const classes = new Set<string>();
  const document = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
  const matchMedia = (q: string) => ({ matches: q === "(display-mode: standalone)" && standalone });
  const navigator = { standalone: iosStandalone };
  const sessionStorage = {
    getItem: (k: string) => {
      if (throws) throw new Error("blocked");
      return k === SPLASH_LAUNCHED_KEY ? launched : null;
    },
  };
  new Function("location", "matchMedia", "navigator", "sessionStorage", "document", SPLASH_SCRIPT)(
    { pathname }, matchMedia, navigator, sessionStorage, document
  );
  return classes.has("splash");
}

describe("앱 시작 화면 — 띄울지 (SPLASH_SCRIPT, 11/20)", () => {
  it("홈 화면 앱으로 시작 주소를 처음 열면 띄운다 — / 와 / 가 보내는 곳", () => {
    for (const p of ["/", "/home", "/start", "/onboarding", "/home/"]) expect(run(p), p).toBe(true);
  });
  it("아이폰 홈 화면 앱(navigator.standalone)도 같다", () => {
    expect(run("/home", { standalone: false, iosStandalone: true })).toBe(true);
  });
  it("브라우저 탭이면 띄우지 않는다 — 처음 온 사람은 대부분 링크로 탭에서 들어온다", () => {
    expect(run("/home", { standalone: false })).toBe(false);
  });
  it("이번 실행에 이미 봤으면 다시 띄우지 않는다", () => {
    expect(run("/home", { launched: "1" })).toBe(false);
  });
  it("시작 주소가 아니면 띄우지 않는다 — 카카오 로그인 복귀 · 알림으로 연 정책 상세 · 결과", () => {
    for (const p of ["/auth/callback", "/find/policies/x", "/result"]) expect(run(p), p).toBe(false);
  });
  it("저장소가 막혀 있으면 조용히 띄우지 않는다", () => {
    expect(run("/home", { throws: true })).toBe(false);
  });
  it("스크립트가 읽는 키 · 주소는 상수와 같다", () => {
    expect(SPLASH_SCRIPT).toContain(JSON.stringify(SPLASH_LAUNCHED_KEY));
    for (const p of LAUNCH_PATHS) expect(SPLASH_SCRIPT).toContain(JSON.stringify(p));
  });
});

describe("아이폰 시작 이미지 (APPLE_SPLASH)", () => {
  it("기종마다 정확한 화면 크기 · 세로 조건이고, 파일이 public/splash 에 있다", () => {
    expect(APPLE_SPLASH.length).toBeGreaterThanOrEqual(10);
    for (const s of APPLE_SPLASH) {
      expect(s.media).toMatch(
        /^\(device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: [23]\) and \(orientation: portrait\)$/
      );
      expect(existsSync(join(process.cwd(), "public", s.href)), s.href).toBe(true);
    }
  });
});
