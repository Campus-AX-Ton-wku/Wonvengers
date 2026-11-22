// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_CHANGE_EVENT, THEME_COLORS, THEME_KEY, THEME_SCRIPT, applyTheme, loadThemeChoice, resolveTheme, saveThemeChoice } from "../theme";

function stubDark(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(prefers-color-scheme: dark)" && matches, addEventListener() {}, removeEventListener() {} }));
}
function addThemeMeta() {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = THEME_COLORS.light;
  document.head.appendChild(meta);
  return meta;
}

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = "";
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});
afterEach(() => vi.unstubAllGlobals());

describe("resolveTheme", () => {
  it("어둡게 · 밝게는 고른 대로, 기기 설정은 기기를 따른다", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("loadThemeChoice", () => {
  it("없거나 모르는 값이면 기기 설정", () => {
    expect(loadThemeChoice()).toBe("system");
    window.localStorage.setItem(THEME_KEY, "blue");
    expect(loadThemeChoice()).toBe("system");
    window.localStorage.setItem(THEME_KEY, "dark");
    expect(loadThemeChoice()).toBe("dark");
  });
});

describe("THEME_SCRIPT — 그리기 전에 정한다", () => {
  const cases: [string | null, boolean, "light" | "dark"][] = [
    [null, false, "light"],
    [null, true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
  ];
  it.each(cases)("저장값 %s · 기기 다크 %s → %s (data-theme · colorScheme · theme-color)", (stored, deviceDark, expected) => {
    if (stored) window.localStorage.setItem(THEME_KEY, stored);
    stubDark(deviceDark);
    const meta = addThemeMeta();
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.documentElement.style.colorScheme).toBe(expected);
    expect(meta.content).toBe(THEME_COLORS[expected]);
  });

  it("무엇이든 실패하면 조용히 넘어간다 — 밝게(CSS 기본)", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("no");
    });
    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe("saveThemeChoice · applyTheme", () => {
  it("고르면 저장 · 적용 · 알림. 기기 설정은 저장값을 지운다", () => {
    stubDark(false);
    const meta = addThemeMeta();
    const heard = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, heard);
    saveThemeChoice("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
    saveThemeChoice("system");
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(THEME_CHANGE_EVENT, heard);
  });

  it("theme-color meta 가 없어도 적용된다", () => {
    stubDark(true);
    expect(applyTheme("system")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
