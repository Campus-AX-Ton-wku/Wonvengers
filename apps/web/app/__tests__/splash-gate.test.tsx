// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SplashGate } from "@/app/components/SplashGate";
import { SPLASH_FADE_MS, SPLASH_LAUNCHED_KEY, SPLASH_MIN_MS } from "@/lib/splash";

const root = () => document.documentElement.classList;

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  root().remove("splash", "splash-out");
  window.history.replaceState({}, "", "/home");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  root().remove("splash", "splash-out");
});

describe("앱 시작 화면 걷기 (SplashGate — 최소 1초, 11/21)", () => {
  it("문서를 연 지 1초가 안 됐으면 남은 시간만큼 보여 준 뒤 0.3초 흐려지며 걷는다 — 이번 실행에 봤다고 바로 적는다", () => {
    root().add("splash");
    vi.spyOn(performance, "now").mockReturnValue(200);
    render(<SplashGate />);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBe("1");
    vi.advanceTimersByTime(SPLASH_MIN_MS - 200 - 1);
    expect(root().contains("splash")).toBe(true);
    expect(root().contains("splash-out")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root().contains("splash-out")).toBe(true);
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(root().contains("splash")).toBe(false);
    expect(root().contains("splash-out")).toBe(false);
  });

  it("이미 1초가 지났으면(느린 연결) 바로 흐려지기 시작한다", () => {
    root().add("splash");
    vi.spyOn(performance, "now").mockReturnValue(1500);
    render(<SplashGate />);
    vi.advanceTimersByTime(0);
    expect(root().contains("splash-out")).toBe(true);
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(root().contains("splash")).toBe(false);
  });

  it("움직임 줄이기면 1초는 보여 주되 흐려짐 없이 걷는다", () => {
    root().add("splash");
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(prefers-reduced-motion: reduce)" }));
    render(<SplashGate />);
    vi.advanceTimersByTime(SPLASH_MIN_MS);
    expect(root().contains("splash")).toBe(false);
    expect(root().contains("splash-out")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("/ 에서는(다음 시작 주소로 넘어가는 중) 걷지도 적지도 않는다 — 다음 문서가 이어서 파랑을 보인다", () => {
    window.history.replaceState({}, "", "/");
    root().add("splash");
    render(<SplashGate />);
    vi.advanceTimersByTime(SPLASH_MIN_MS + SPLASH_FADE_MS);
    expect(root().contains("splash")).toBe(true);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBeNull();
  });

  it("시작 화면이 없으면 아무것도 하지 않는다", () => {
    render(<SplashGate />);
    vi.advanceTimersByTime(SPLASH_MIN_MS + SPLASH_FADE_MS);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBeNull();
  });
});
