/**
 * 다크 모드 (docs/기획/2026-11-22-다크-모드-설계.md §1).
 *
 * 고른 값은 이 기기에만(perky.theme) — 서버로 보내지 않고 로그아웃해도 남긴다(온보딩 본 기록 같은 기기 설정).
 * '기기 설정'(system)은 저장값을 지운 상태다. 적용은 <html data-theme> · colorScheme · <meta name="theme-color">.
 * 그리기 전에는 <head> 의 THEME_SCRIPT, 그 뒤 바뀜은 ThemeWatcher 가 applyTheme 으로 다시 건다.
 */

export const THEME_KEY = "perky.theme";
export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
/** 상단 상태 표시줄 · 브라우저 막대 색 = 페이지 바탕(canvas) */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#f4f8ff", dark: "#0c1620" };
/** 이 탭에서 고른 값이 바뀌었다 — ThemeWatcher · 내 정보 화면이 듣는다 */
export const THEME_CHANGE_EVENT = "perky:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  return choice === "dark" || (choice === "system" && prefersDark) ? "dark" : "light";
}

export function loadThemeChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return isThemeChoice(value) ? value : "system";
  } catch {
    return "system";
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia?.(DARK_QUERY).matches === true;
  } catch {
    return false;
  }
}

export function applyTheme(choice: ThemeChoice = loadThemeChoice()): ResolvedTheme {
  const theme = resolveTheme(choice, prefersDark());
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  return theme;
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // 저장이 막혀 있어도 이번 화면에는 적용한다
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** 기기의 다크 설정이 바뀔 때. matchMedia 가 없으면 아무것도 안 한다. */
export function onSystemThemeChange(listener: () => void): () => void {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  if (!query?.addEventListener) return () => {};
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * 번들보다 먼저 도는 인라인 스크립트 — import 없이 값을 글자로 박는다(lib/splash.ts 와 같은 방식, 시험이 실제로 돌려 본다).
 * 실패하면 아무것도 안 한다 — 그러면 CSS 기본(밝게)이다.
 */
export const THEME_SCRIPT = `try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=c==="dark"||(c!=="light"&&matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?${JSON.stringify(
  THEME_COLORS.dark
)}:${JSON.stringify(THEME_COLORS.light)})}catch(e){}`;
