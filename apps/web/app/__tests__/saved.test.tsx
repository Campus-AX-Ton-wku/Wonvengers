// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import SavedPage from "@/app/saved/page";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveSavedList } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const 주거급여서류 = (policiesJson as PolicyMeta[]).find((p) => p.id === "youth-housing-benefit-split-payment")?.documents ?? [];
const 익산_재직 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "재직" as const, incomeBracket: 1, housingType: "월세" as const };

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("/saved — 관심 탭", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다 — 찜은 로그인한 사람만 쓴다", async () => {
    enableLogin();
    render(<SavedPage />);
    expect(replacePage).toHaveBeenCalledWith("/onboarding");
  });

  it("찜한 지원금 — 비면 안내와 찾아보기, 있으면 건수 · 마감 배지 · 진행 막대 (홈에 있던 그대로)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const { unmount } = render(<SavedPage />);
    const empty = await screen.findByRole("region", { name: "찜한 지원금" });
    expect(within(empty).getByText("아직 찜한 지원금이 없어요")).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "찾아보기" }).getAttribute("href")).toBe("/find/policies");
    unmount();

    saveSavedList(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
    render(<SavedPage />);
    const list = await screen.findByRole("region", { name: "찜한 지원금" });
    expect(within(list).getByRole("heading", { level: 2 }).textContent).toBe("찜한 지원금 2건");
    const card = within(list).getByRole("link", { name: /청년 주거급여 분리지급/ });
    expect(card.getAttribute("href")).toBe("/find/policies/youth-housing-benefit-split-payment/prepare");
    expect(within(card).getByText("상시")).toBeTruthy();
    expect(within(card).getByText(`서류 0/${주거급여서류.length} 준비`)).toBeTruthy();
    expect([...card.querySelectorAll("img[data-icon3d]")].map((img) => img.getAttribute("data-icon3d"))).toEqual(["housing-benefit"]);
    const closed = within(list).getByRole("link", { name: /청년월세 지원/ });
    expect(within(closed).getByText("접수 마감")).toBeTruthy();
    expect(within(closed).getByText(/다음 공고를 기다려요/)).toBeTruthy();
  });

  it("하단 섬에서 '관심'이 지금 화면이다", async () => {
    enableLogin(); signInAs("sub-a");
    render(<SavedPage />);
    const tabs = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(within(tabs).getByRole("link", { name: "관심" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "홈" }).getAttribute("aria-current")).toBeNull();
  });
});
