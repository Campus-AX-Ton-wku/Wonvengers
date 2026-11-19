// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import { BottomTabBar } from "@/app/components";
import { resetAuthForTests } from "@/lib/auth";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("하단 섬 탭 (BottomTabBar)", () => {
  it("로그인 전에는 그리지 않는다 — 홈 · 관심은 로그인한 사람만 들어간다", () => {
    enableLogin();
    render(<BottomTabBar active="benefit" />);
    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).toBeNull();
  });

  it("로그인을 쓸 수 없는 빌드에서도 그리지 않는다", () => {
    signInAs();
    render(<BottomTabBar active="benefit" />);
    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).toBeNull();
  });

  it("홈 · 관심 · 계산 · 지원금 · 내 정보 — 계산이 가운데, 지금 화면은 aria-current", async () => {
    enableLogin();
    signInAs();
    render(<BottomTabBar active="benefit" />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["홈", "관심", "계산", "지원금", "내 정보"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/home", "/saved", "/calculate", "/find/policies", "/account"]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, null, null, "page", null]);
    // 선택된 탭만 채운 아이콘 — 색 하나에 기대지 않는다
    expect([...nav.querySelectorAll("svg[data-filled]")].map((svg) => svg.getAttribute("data-tab-icon"))).toEqual(["benefit"]);
  });

  it("계산을 마쳤으면 계산 탭은 결과로 간다", async () => {
    enableLogin();
    signInAs();
    saveListing(makeListing({ region: "전북특별자치도 익산시" }));
    saveProfile(makeProfile());
    render(<BottomTabBar active="home" />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(within(nav).getByRole("link", { name: "계산" }).getAttribute("href")).toBe("/result");
  });
});
