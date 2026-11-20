// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SplashGate } from "@/app/components/SplashGate";
import { SPLASH_FADE_MS, SPLASH_LAUNCHED_KEY } from "@/lib/splash";

const root = () => document.documentElement.classList;

beforeEach(() => {
  window.sessionStorage.clear();
  root().remove("splash", "splash-out");
  window.history.replaceState({}, "", "/home");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  root().remove("splash", "splash-out");
});

describe("앱 시작 화면 걷기 (SplashGate, 11/20)", () => {
  it("화면이 0.3초 안에 뜨면 흐려짐 없이 바로 걷고, 이번 실행에 봤다고 적는다", () => {
    root().add("splash");
    vi.spyOn(performance, "now").mockReturnValue(120);
    render(<SplashGate />);
    expect(root().contains("splash")).toBe(false);
    expect(root().contains("splash-out")).toBe(false);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBe("1");
  });

  it("0.3초가 지났으면 0.2초 흐려진 뒤 걷는다", () => {
    vi.useFakeTimers();
    root().add("splash");
    vi.spyOn(performance, "now").mockReturnValue(900);
    render(<SplashGate />);
    expect(root().contains("splash-out")).toBe(true);
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(root().contains("splash")).toBe(false);
    expect(root().contains("splash-out")).toBe(false);
  });

  it("/ 에서는(다음 시작 주소로 넘어가는 중) 걷지도 적지도 않는다 — 다음 문서가 이어서 파랑을 보인다", () => {
    window.history.replaceState({}, "", "/");
    root().add("splash");
    render(<SplashGate />);
    expect(root().contains("splash")).toBe(true);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBeNull();
  });

  it("시작 화면이 없으면 아무것도 하지 않는다", () => {
    render(<SplashGate />);
    expect(window.sessionStorage.getItem(SPLASH_LAUNCHED_KEY)).toBeNull();
  });
});
