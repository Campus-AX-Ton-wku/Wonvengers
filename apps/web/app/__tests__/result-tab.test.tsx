// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import ResultPage from "@/app/result/page";
import { resetAuthForTests } from "@/lib/auth";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

it("결과 화면은 홈의 하위 화면 — 하단 섬은 '홈'에 불 (계산 탭이 없어졌다, 11/21)", async () => {
  enableLogin();
  signInAs();
  saveListing(makeListing());
  saveProfile(makeProfile());
  render(<ResultPage />);
  const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getByRole("link", { name: "홈" }).getAttribute("aria-current")).toBe("page");
});
