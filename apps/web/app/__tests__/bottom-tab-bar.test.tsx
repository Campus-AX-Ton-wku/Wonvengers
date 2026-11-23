// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(() => Promise.resolve()),
}));

import { BottomTabBar } from "@/app/components";
import { resetAuthForTests, signIn } from "@/lib/auth";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("하단 섬 탭 (BottomTabBar)", () => {
  it("로그인 전에는 탭 대신 [카카오로 로그인하고 홈으로] — 질문을 끝낸 화면에서 홈으로 갈 길 (11/22)", async () => {
    enableLogin();
    render(<BottomTabBar active="benefit" />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /카카오로 로그인하고 홈으로/ }));
    expect(signIn).toHaveBeenCalledWith("/home");
    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).toBeNull();
  });

  it("guestAction 으로 비회원 버튼의 문구와 돌아갈 곳을 바꾼다 (지원금 목록 · 11/23)", async () => {
    enableLogin();
    render(<BottomTabBar active="benefit" guestAction={{ label: "카카오로 로그인하고 내 최종 주거비 확인하기", returnTo: "/calculate" }} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /내 최종 주거비 확인하기/ }));
    expect(signIn).toHaveBeenCalledWith("/calculate");
  });

  it("내 정보 화면은 본문에 카카오 버튼이 있어 띄우지 않는다", () => {
    enableLogin();
    render(<BottomTabBar active="my" />);
    expect(screen.queryByRole("button", { name: /카카오/ })).toBeNull();
  });

  it("로그인을 쓸 수 없는 빌드에서도 그리지 않는다", () => {
    signInAs();
    render(<BottomTabBar active="benefit" />);
    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).toBeNull();
    expect(screen.queryByRole("button", { name: /카카오/ })).toBeNull();
  });

  it("홈 · 관심 · 지원금 · 달력 · 내 정보 — 계산 탭은 없다(계산은 홈이 맡는다, 11/21), 지금 화면은 aria-current", async () => {
    enableLogin();
    signInAs();
    render(<BottomTabBar active="ledger" />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["홈", "관심", "지원금", "달력", "내 정보"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/home", "/saved", "/find/policies", "/ledger", "/account"]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, null, null, "page", null]);
    // 선택된 탭만 채운 아이콘 — 색 하나에 기대지 않는다
    expect([...nav.querySelectorAll("svg[data-filled]")].map((svg) => svg.getAttribute("data-tab-icon"))).toEqual(["ledger"]);
  });

  it("탭 글자는 12px (시안 '하단 섬 · 상단바 설계' 11/21)", async () => {
    enableLogin();
    signInAs();
    render(<BottomTabBar active="home" />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(within(nav).getByText("달력").className).toContain("text-[12px]");
  });
});
