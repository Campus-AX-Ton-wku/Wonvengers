// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ThemeWatcher } from "@/app/components";
import { THEME_KEY } from "@/lib/theme";

let dark = false;
let listeners: (() => void)[] = [];
beforeEach(() => {
  window.localStorage.clear();
  dark = false;
  listeners = [];
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() {
      return q === "(prefers-color-scheme: dark)" && dark;
    },
    addEventListener: (_: string, l: () => void) => listeners.push(l),
    removeEventListener: (_: string, l: () => void) => (listeners = listeners.filter((x) => x !== l)),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("기기 설정이 바뀌면 따라간다 — '기기 설정'일 때만", () => {
  render(<ThemeWatcher />);
  dark = true;
  act(() => listeners.forEach((l) => l()));
  expect(document.documentElement.dataset.theme).toBe("dark");
  window.localStorage.setItem(THEME_KEY, "light");
  act(() => listeners.forEach((l) => l()));
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("다른 탭에서 바꾸면(storage) 따라간다", () => {
  render(<ThemeWatcher />);
  window.localStorage.setItem(THEME_KEY, "dark");
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
  });
  expect(document.documentElement.dataset.theme).toBe("dark");
});
