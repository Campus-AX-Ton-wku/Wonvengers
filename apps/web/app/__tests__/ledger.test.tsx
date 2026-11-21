// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import LedgerPage from "@/app/ledger/page";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { addMonths, monthKeyOf, monthLabel, monthOnlyLabel, oneTimeSupports } from "@/lib/ledger";
import { replacePage } from "@/lib/redirect";
import { policiesForRegion } from "@/lib/region";
import { loadLedger, saveListing, saveProfile } from "@/lib/storage";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

// 이번 달이 '계약 3개월째'가 되게 — 두 달 전 1일에 시작한 12개월 월세
const thisMonth = monthKeyOf(seoulTodayISO());
const start = addMonths(thisMonth, -2);
const listing = makeListing({ region: "전북특별자치도 익산시", contractType: "월세", rentOrYearlyAmount: 400_000, managementFee: 50_000, contractStartDate: `${start}-01`, months: 12 });
const profile = makeProfile();

function calculated() {
  saveListing(listing);
  saveProfile(profile);
}

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
  enableLogin();
  signInAs("sub-a");
});
afterEach(() => vi.unstubAllEnvs());

describe("/ledger — 주거비 달력", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다", () => {
    window.localStorage.clear();
    render(<LedgerPage />);
    expect(replacePage).toHaveBeenCalledWith("/onboarding");
  });

  it("계산 전 — '먼저 내 월세를 계산해요' + [계산하기] → /calculate, 한 번 받는 지원은 없다", async () => {
    render(<LedgerPage />);
    expect(await screen.findByRole("heading", { name: "먼저 내 월세를 계산해요" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /계산하기/ }).getAttribute("href")).toBe("/calculate");
    expect(screen.queryByRole("region", { name: "한 번 받는 지원" })).toBeNull();
  });

  it("계산값이 미리 적혀 있다 — 이번 달, 계약 3개월째, 월세 · 관리비", async () => {
    calculated();
    render(<LedgerPage />);
    expect(await screen.findByText(monthLabel(thisMonth))).toBeTruthy();
    const card = screen.getByRole("region", { name: `${monthOnlyLabel(thisMonth)} 주거비` });
    expect(within(card).getByRole("heading", { name: "계약 3개월째" })).toBeTruthy();
    expect(within(card).getByText(`${monthLabel(start)} 시작 · 12개월`)).toBeTruthy();
    expect(within(card).getByRole("button", { name: "월세 금액 40만원, 고치기" })).toBeTruthy();
    expect(within(card).getByRole("button", { name: "관리비 금액 5만원, 고치기" })).toBeTruthy();
    expect(within(card).getByText(/아직 안 누른 칸은 빼고 셈해요/)).toBeTruthy();
  });

  it("[냈어요]를 누르면 기록되고 실제 부담에 더해진다, 다시 누르면 취소", async () => {
    calculated();
    const user = userEvent.setup();
    render(<LedgerPage />);
    const button = await screen.findByRole("button", { name: "월세 냈어요" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await user.click(button);
    expect(screen.getByRole("button", { name: "월세 냈어요" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("ledger-actual").textContent).toBe("40만원");
    expect(loadLedger().months[thisMonth].done).toEqual({ rent: 400_000 });
    await user.click(screen.getByRole("button", { name: "월세 냈어요" }));
    expect(screen.getByTestId("ledger-actual").textContent).toBe("0원");
    expect(loadLedger().months[thisMonth].done).toEqual({});
  });

  it("금액을 눌러 이 달만 고친다 — '고침' + '계산할 때 5만원', [계산값으로]로 되돌린다", async () => {
    calculated();
    const user = userEvent.setup();
    render(<LedgerPage />);
    await user.click(await screen.findByRole("button", { name: "관리비 금액 5만원, 고치기" }));
    const sheet = screen.getByRole("dialog", { name: `${monthOnlyLabel(thisMonth)} 관리비` });
    // 소수점 입력은 한 번에 넣는다 — 글자마다 치면 "4." 중간 상태가 테스트 환경마다 다르게 다뤄진다(실기기 입력은 Task 6 에서 확인)
    fireEvent.change(within(sheet).getByLabelText(/실제 금액/), { target: { value: "4.2" } });
    await user.click(within(sheet).getByRole("button", { name: "저장" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "관리비 금액 4만 2,000원 (고침), 고치기" })).toBeTruthy();
    expect(screen.getByText("계산할 때 5만원")).toBeTruthy();
    expect(loadLedger().months[thisMonth].amounts).toEqual({ fee: 42_000 });

    await user.click(screen.getByRole("button", { name: "관리비 금액 4만 2,000원 (고침), 고치기" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "계산값으로" }));
    expect(screen.getByRole("button", { name: "관리비 금액 5만원, 고치기" })).toBeTruthy();
    expect(loadLedger().months[thisMonth].amounts).toEqual({});
  });

  it("달을 넘기면 계약 기간 밖 안내, [계약 시작 달로 가기]로 1개월째", async () => {
    calculated();
    const user = userEvent.setup();
    render(<LedgerPage />);
    await screen.findByText(monthLabel(thisMonth));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "이전 달" }));
    expect(screen.getByText(monthLabel(addMonths(start, -1)))).toBeTruthy();
    expect(screen.getByRole("heading", { name: "계약 기간 밖이에요" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: `계약 시작 달(${monthOnlyLabel(start)})로 가기` }));
    expect(screen.getByRole("heading", { name: "계약 1개월째" })).toBeTruthy();
  });

  it("한 번 받는 지원 — 결과에서 받을 수 있다고 나온 일시금, [받았어요] 누르면 'N월에 받음'", async () => {
    calculated();
    const summary = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, seoulTodayISO());
    const expected = oneTimeSupports(summary);
    // 11/21 데이터: 익산 일시금 중 가능성 있음 · 확인 필요가 있다. 0건이 되면 이 테스트의 기준 데이터를 다시 고를 것
    expect(expected.length).toBeGreaterThan(0);
    const user = userEvent.setup();
    render(<LedgerPage />);
    const section = await screen.findByRole("region", { name: "한 번 받는 지원" });
    for (const { policy } of expected) expect(within(section).getByText(policy.name)).toBeTruthy();
    const first = expected[0].policy;
    await user.click(within(section).getByRole("button", { name: `${first.name} 받았어요` }));
    expect(within(section).getByText(`${monthOnlyLabel(thisMonth)}에 받음`)).toBeTruthy();
    expect(loadLedger().oneTime).toEqual({ [first.id]: thisMonth });
  });

  it("한 번 받는 지원 — 조건충족시가능은 '확인 필요' 태그, 가능성 있음(예상적용)엔 없다", async () => {
    calculated();
    const summary = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, seoulTodayISO());
    const expected = oneTimeSupports(summary);
    const check = expected.filter((o) => o.status === "조건충족시가능");
    // 11/21 데이터: 익산 재직 프로필에 학생 전용 일시금이 '조건충족시가능'으로 나온다. 0건이 되면 기준 데이터를 다시 고를 것
    expect(check.length).toBeGreaterThan(0);
    render(<LedgerPage />);
    const section = await screen.findByRole("region", { name: "한 번 받는 지원" });
    expect(within(section).getAllByText("확인 필요")).toHaveLength(check.length);
    for (const { policy, status } of expected) {
      const item = within(section).getByText(policy.name).closest("li") as HTMLElement;
      expect(within(item).queryByText("확인 필요") !== null).toBe(status === "조건충족시가능");
    }
  });

  it("연세 + 관리비 0원 — 계약 2개월째 이후엔 나가는 돈 칸이 없어 '나가는 돈' 묶음을 그리지 않는다", async () => {
    // 연세는 계약 1개월째에만 낸다 (설계 §4.2) — 관리비도 0이면 이 달 나가는 돈은 0건
    saveListing(makeListing({ region: "전북특별자치도 익산시", contractType: "연세", rentOrYearlyAmount: 4_800_000, managementFee: 0, contractStartDate: `${start}-01`, months: 12 }));
    saveProfile(profile);
    render(<LedgerPage />);
    const card = await screen.findByRole("region", { name: `${monthOnlyLabel(thisMonth)} 주거비` });
    expect(within(card).queryByText("나가는 돈")).toBeNull();
    expect(within(card).getByRole("heading", { name: "계약 3개월째" })).toBeTruthy();
  });

  it("들어오는 지원이 없는 달엔 '들어오는 돈' 묶음을 그리지 않는다", async () => {
    // 나이 상한을 한참 넘긴 생년월일이면 어느 지역이든 월 지원이 합계에 들지 않는다 — 결정적으로 들어오는 돈 줄 0건
    saveListing(listing);
    saveProfile(makeProfile({ birthDate: "1975-01-01" }));
    render(<LedgerPage />);
    const card = await screen.findByRole("region", { name: `${monthOnlyLabel(thisMonth)} 주거비` });
    expect(within(card).queryByText("들어오는 돈")).toBeNull();
    expect(within(card).getByText("나가는 돈")).toBeTruthy();
  });

  it("맨 아래 안내 한 줄, 하단 섬은 '달력'에 불", async () => {
    calculated();
    render(<LedgerPage />);
    expect(await screen.findByText("기록은 이 기기에만 저장돼요. 로그아웃하면 지워져요.")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(nav).getByRole("link", { name: "달력" }).getAttribute("aria-current")).toBe("page");
  });
});
