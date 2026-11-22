// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSetting } from "@/app/account/ThemeSetting";
import { THEME_KEY } from "@/lib/theme";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

it("'화면 모드' — 기기 설정 · 밝게 · 어둡게, 처음엔 기기 설정", () => {
  render(<ThemeSetting />);
  const group = screen.getByRole("group", { name: "화면 모드" });
  const buttons = within(group).getAllByRole("button");
  expect(buttons.map((b) => b.textContent)).toEqual(["기기 설정", "밝게", "어둡게"]);
  expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
});

it("어둡게를 누르면 저장 · 바로 적용, 기기 설정으로 돌리면 저장값을 지우고 기기를 따른다", async () => {
  const user = userEvent.setup();
  render(<ThemeSetting />);
  await user.click(screen.getByRole("button", { name: "어둡게" }));
  expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("button", { name: "어둡게" }).getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "기기 설정" }));
  expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
  expect(document.documentElement.dataset.theme).toBe("light");
});
