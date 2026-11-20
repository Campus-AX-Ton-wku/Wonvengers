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
    expect(within(summary).getByText("보증금·월세를 넣으면 최종 주거비를 계산해요.")).toBeTruthy();
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

  it("찜한 지원금 목록은 홈에 없다 — 하단 섬 '관심' 탭으로 옮겼다 (11/20)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList(["youth-housing-benefit-split-payment"]);
    render(<HomePage />);
    await screen.findByRole("region", { name: "내 지원 요약" });
    expect(screen.queryByRole("region", { name: "관심 지원금" })).toBeNull();
    const tabs = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(tabs).getByRole("link", { name: "홈" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "관심" }).getAttribute("href")).toBe("/saved");
  });

  it("요약 아래 주거 가이드 세 장 — 전체 보기는 /guides", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    const guides = await screen.findByRole("region", { name: "주거 가이드" });
    expect(within(guides).getByRole("link", { name: /전체 보기/ }).getAttribute("href")).toBe("/guides");
    const cards = within(guides).getAllByRole("listitem").map((li) => within(li).getByRole("link").getAttribute("href"));
    expect(cards).toEqual(["/guides/before-contract", "/guides/protect-deposit", "/guides/where-documents"]);
  });

  it("계산이 끝났으면 최종 예상 주거비 상자와 결과 보기, 계산하기는 숨긴다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    const profile = makeProfile();
    saveListing(listing); saveProfile(profile);
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, todayISO());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    // 시안 '홈 · 사용 중'(11/20) — 상자 전체가 결과로 가는 링크 하나, 지원 전 → 지원 후, 줄어든 돈 한 줄
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비, 12개월 기준\. 지원 전 .+, 지원 후 .+\. 결과 보기$/ });
    expect(box.getAttribute("href")).toBe("/result");
    expect(within(box).getByText("12개월 기준")).toBeTruthy();
    expect(within(box).getByText(formatKoreanMoney(s.nominalTotalCost))).toBeTruthy();
    expect(within(box).getByText(formatKoreanMoney(s.finalEstimatedHousingCost)).className).toContain("text-brand-900");
    expect(within(box).getByText(formatKoreanMoney(s.nominalTotalCost - s.finalEstimatedHousingCost)).parentElement?.textContent).toMatch(/줄었어요$/);
    expect(box.querySelector('[class*="accent-"]')).toBeNull();
    expect(within(summary).queryByRole("link", { name: "내 월세 계산하기" })).toBeNull();
  });

  it("지금 신청할 수 있는 게 0건이면 '줄었어요'는 빼고 지원 전 → 지원 후만 (0건인데 줄었다는 말이 되지 않게)", async () => {
    enableLogin(); signInAs("sub-a");
    // 만 17세 · 소득 최상위 — 익산에서 지금 신청할 수 있는 게 없다 (11/20 데이터 기준)
    saveAnswers({ ...익산_재직, birthDate: birthDateForAge(17), incomeBracket: 10 });
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    saveListing(listing); saveProfile(makeProfile());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByTestId("open-count").textContent).toMatch(/^0/);
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비/ });
    expect(within(box).queryByText(/줄었어요/)).toBeNull();
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
      expect(within(summary).getByText("관심 지원금 준비를 마쳤어요.")).toBeTruthy();
    });

    it("답이 없으면 캐릭터를 두지 않는다", async () => {
      enableLogin(); signInAs("sub-a");
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBeUndefined();
    });
  });
});
