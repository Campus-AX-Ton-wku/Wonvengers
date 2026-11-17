// apps/web/app/__tests__/home.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import HomePage from "@/app/home/page";
import { resetAuthForTests } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveListing, saveProfile, saveSavedList } from "@/lib/storage";
import policiesJson from "@/data/policies.json";
import { todayISO } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import { policiesForRegion } from "@/lib/region";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

const 익산_재직 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "재직" as const, incomeBracket: 1, housingType: "월세" as const };

describe("/home", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다", async () => {
    enableLogin();
    render(<HomePage />);
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/onboarding"));
  });

  it("제목 · 내 조건 한 줄 · 조건 수정", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("내 주거지원 현황");
    expect(screen.getByText("25세 · 익산시 · 재직")).toBeTruthy();
    expect(screen.getByRole("link", { name: /조건 수정/ }).getAttribute("href")).toBe("/find");
  });

  it("지원 요약 — 받을 수 있는 수와 목록 링크, 계산 전이면 계산하기", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByText(/지금 받을 수 있는 지원금 \d+건/)).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "목록 보기" }).getAttribute("href")).toBe("/find/policies");
    expect(within(summary).getByRole("link", { name: "내 월세 계산하기" }).getAttribute("href")).toBe("/calculate");
  });

  it("답 전이면 시작하기", async () => {
    enableLogin(); signInAs("sub-a");
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByRole("link", { name: "시작하기" }).getAttribute("href")).toBe("/find");
  });

  it("찜한 정책 — 카드는 신청 준비로, 비면 안내와 지원금 찾기", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const { unmount } = render(<HomePage />);
    const empty = await screen.findByRole("region", { name: "찜한 지원금" });
    expect(within(empty).getByText("아직 찜한 지원금이 없어요")).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "지원금 찾기" }).getAttribute("href")).toBe("/find/policies");
    unmount();

    saveSavedList(["youth-housing-benefit-split-payment"]);
    render(<HomePage />);
    const list = await screen.findByRole("region", { name: "찜한 지원금" });
    const card = within(list).getByRole("link", { name: /청년 주거급여 분리지급/ });
    expect(card.getAttribute("href")).toBe("/find/policies/youth-housing-benefit-split-payment/prepare");
    expect(within(card).getByText("상시")).toBeTruthy();
    expect(within(card).getByText("확인 0/3")).toBeTruthy();
  });

  it("계산이 끝났으면 지원 전후 월세와 결과 보기, 계산하기 링크는 숨긴다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    const profile = makeProfile();
    saveListing(listing); saveProfile(profile);
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, todayISO());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(summary.textContent).toContain(`지원받으면 ${formatKoreanMoney(s.nominalTotalCost)} → ${formatKoreanMoney(s.finalEstimatedHousingCost)}`);
    expect(within(summary).getByRole("link", { name: "결과 보기" }).getAttribute("href")).toBe("/result");
    expect(within(summary).queryByRole("link", { name: "내 월세 계산하기" })).toBeNull();
  });
});
