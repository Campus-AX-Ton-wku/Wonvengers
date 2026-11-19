// apps/web/app/__tests__/home.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import HomePage from "@/app/home/page";
import { AUTH_KEY, resetAuthForTests, signOut } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveChecklist, saveDocumentChecks, saveListing, saveProfile, saveSavedList } from "@/lib/storage";
import policiesJson from "@/data/policies.json";
import { todayISO } from "@/lib/date";
import { openPolicies } from "@/lib/home";
import { formatKoreanMoney } from "@/lib/money";
import { policiesForRegion } from "@/lib/region";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const 주거급여서류 = (policiesJson as PolicyMeta[]).find((p) => p.id === "youth-housing-benefit-split-payment")?.documents ?? [];

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
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  it("홈을 열어 둔 사이 로그인이 풀리면(만료 · 다른 탭 로그아웃) 온보딩으로 보낸다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    expect(replacePage).not.toHaveBeenCalled();
    act(() => signOut({ redirect: false }));
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  it("다른 탭에서 로그아웃해 로그인 기록이 지워져도 온보딩으로 보낸다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    window.localStorage.removeItem(AUTH_KEY);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: AUTH_KEY })); });
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  it("제목 · 내 조건 칩 → 조건 수정", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("내 주거지원 현황");
    const chip = screen.getByRole("link", { name: "내 조건 25세 · 익산시 · 재직 — 조건 수정" });
    expect(chip.getAttribute("href")).toBe("/find");
    expect(chip.textContent).toBe("25세·익산시·재직수정");
  });

  it("왼쪽 위 로고는 링크가 아니다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /Perky/ })).toBeNull();
  });

  it("지원 요약 — 지금 신청할 수 있는 수, 찜이 없으면 목록 앞 3건 미리 보기, 계산 전이면 계산하기", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const open = openPolicies(policiesJson as PolicyMeta[], 익산_재직, todayISO()) ?? [];
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByText("지금 신청할 수 있는 지원금")).toBeTruthy();
    expect(within(summary).getByTestId("open-count").textContent).toBe(`${open.length}건`);
    expect(within(summary).queryByText(/공고 기준이에요/)).toBeNull();

    const preview = within(summary).getByRole("list", { name: "신청할 수 있는 지원금 미리 보기" });
    const rows = within(preview).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(open.slice(0, 3).map((p) => `/find/policies/${p.id}`));

    const all = within(summary).getByRole("link", { name: open.length > 3 ? `${open.length}건 모두 보기` : "지원금 목록 보기" });
    expect(all.getAttribute("href")).toBe("/find/policies");
    expect(within(summary).getByText("실제로 내게 될 돈은 얼마일까요?")).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "내 월세 계산하기" }).getAttribute("href")).toBe("/calculate");
    // 3D 그림은 계산 권유 칸의 계산기 48px 하나 — 미리 보기 줄에는 두지 않는다(Perky 와 한 카드에 그림이 몰리지 않게, 11/20)
    const pictures = [...summary.querySelectorAll("img[data-icon3d]")];
    expect(pictures.map((img) => img.getAttribute("data-icon3d"))).toEqual(["calculator"]);
    expect(pictures[0].getAttribute("width")).toBe("48");
  });

  it("찜이 있으면 미리 보기를 빼고 목록 보기 버튼만", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList(["youth-housing-benefit-split-payment"]);
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).queryByRole("list")).toBeNull();
    expect(within(summary).getByRole("link", { name: "지원금 목록 보기" }).getAttribute("href")).toBe("/find/policies");
  });

  it("답 전이면 시작하기", async () => {
    enableLogin(); signInAs("sub-a");
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByRole("link", { name: "시작하기" }).getAttribute("href")).toBe("/find");
  });

  it("찜한 지원금 — 비면 안내와 찾아보기, 있으면 건수 · 마감 배지 · 진행 막대", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const { unmount } = render(<HomePage />);
    const empty = await screen.findByRole("region", { name: "찜한 지원금" });
    expect(within(empty).getByText("아직 찜한 지원금이 없어요")).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "찾아보기" }).getAttribute("href")).toBe("/find/policies");
    unmount();

    saveSavedList(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
    render(<HomePage />);
    const list = await screen.findByRole("region", { name: "찜한 지원금" });
    expect(within(list).getByRole("heading", { level: 2 }).textContent).toBe("찜한 지원금 2건");
    const card = within(list).getByRole("link", { name: /청년 주거급여 분리지급/ });
    expect(card.getAttribute("href")).toBe("/find/policies/youth-housing-benefit-split-payment/prepare");
    expect(within(card).getByText("상시")).toBeTruthy();
    expect(within(card).getByText(`서류 0/${주거급여서류.length} 준비`)).toBeTruthy();
    // 찜 카드도 목록 카드처럼 정책 종류 그림 40px
    expect([...card.querySelectorAll("img[data-icon3d]")].map((img) => img.getAttribute("data-icon3d"))).toEqual(["housing-benefit"]);
    const closed = within(list).getByRole("link", { name: /청년월세 지원/ });
    expect(within(closed).getByText("접수 마감")).toBeTruthy();
    expect(within(closed).getByText(/다음 공고를 기다려요/)).toBeTruthy();
  });

  it("계산이 끝났으면 최종 예상 주거비 상자와 결과 보기, 계산하기는 숨긴다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    const profile = makeProfile();
    saveListing(listing); saveProfile(profile);
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, todayISO());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByText("최종 예상 주거비")).toBeTruthy();
    expect(within(summary).getByText(formatKoreanMoney(s.finalEstimatedHousingCost))).toBeTruthy();
    expect(within(summary).getByText(formatKoreanMoney(s.nominalTotalCost))).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "결과 보기" }).getAttribute("href")).toBe("/result");
    expect(within(summary).queryByRole("link", { name: "내 월세 계산하기" })).toBeNull();
  });

  describe("요약 카드 Perky 포즈", () => {
    const pose = () => document.querySelector("[data-pose]")?.getAttribute("data-pose");

    it("신청할 수 있는 게 있으면 found", async () => {
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBe("found");
    });

    it("지금 신청할 수 있는 찜을 모두 준비했으면 success와 그 뜻의 문장", async () => {
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveSavedList(["youth-housing-benefit-split-payment"]);
      saveChecklist("youth-housing-benefit-split-payment", { eligibility: true, period: true, documents: true });
      // 서류 목록이 있는 정책은 홈 카드가 서류만 센다 — 서류를 모두 챙겨야 '준비 끝'
      saveDocumentChecks("youth-housing-benefit-split-payment", 주거급여서류.map((d) => d.name));
      render(<HomePage />);
      const summary = await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBe("success");
      expect(within(summary).getByText("찜한 지원금 준비를 마쳤어요. 이제 신청만 남았어요.")).toBeTruthy();
    });

    it("답이 없으면 캐릭터를 두지 않는다", async () => {
      enableLogin(); signInAs("sub-a");
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBeUndefined();
    });
  });
});
