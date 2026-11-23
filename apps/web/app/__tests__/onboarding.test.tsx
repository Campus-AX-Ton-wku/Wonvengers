// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(() => Promise.resolve()),
}));

import OnboardingPage from "@/app/onboarding/page";
import { AUTO_MS } from "@/app/onboarding/Onboarding";
import StartPage from "@/app/start/page";
import { signIn } from "@/lib/auth";
import { hasSeenOnboarding } from "@/lib/storage";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";
import { routerMock } from "./navigation-mock";

const 마지막장 = /받을 수 있는 지원과/;

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(signIn).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

const 제목 = () => screen.getByRole("heading", { level: 1 }).textContent ?? "";

describe("온보딩 2장", () => {
  it("질문 수는 숫자로 못 박지 않는다 — '몇 가지 질문만' (11/23)", async () => {
    render(<OnboardingPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "2단계 · 안내" }));

    expect(screen.getByText(/몇 가지 질문만\s*답하면 돼요/)).toBeTruthy();
    expect(screen.queryByText(/다섯 가지|네 가지/)).toBeNull();
  });
});

describe("넘기기 — [다음] 없이 밀거나 기다린다 (11/23)", () => {
  afterEach(() => vi.useRealTimers());

  it("[다음] · [이전] 버튼이 없다", () => {
    render(<OnboardingPage />);
    expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
    expect(screen.queryByRole("button", { name: "이전" })).toBeNull();
  });

  it("가만히 두면 AUTO_MS 마다 다음 장으로 가고, 마지막 장에서 멈춘다", () => {
    vi.useFakeTimers();
    render(<OnboardingPage />);
    expect(제목()).toMatch(/흩어진 청년 혜택을/);
    act(() => vi.advanceTimersByTime(AUTO_MS - 1));
    expect(제목()).toMatch(/흩어진 청년 혜택을/);
    act(() => vi.advanceTimersByTime(1));
    expect(제목()).toMatch(/몇 가지 질문만/);
    act(() => vi.advanceTimersByTime(AUTO_MS));
    expect(제목()).toMatch(마지막장);
    act(() => vi.advanceTimersByTime(AUTO_MS * 3));
    expect(제목()).toMatch(마지막장);
  });

  it("손으로 넘기면 시간을 처음부터 다시 센다", () => {
    vi.useFakeTimers();
    render(<OnboardingPage />);
    act(() => vi.advanceTimersByTime(AUTO_MS - 500));
    fireEvent.click(screen.getByRole("button", { name: "2단계 · 안내" }));
    act(() => vi.advanceTimersByTime(AUTO_MS - 1));
    expect(제목()).toMatch(/몇 가지 질문만/);
    act(() => vi.advanceTimersByTime(1));
    expect(제목()).toMatch(마지막장);
  });

  it("왼쪽으로 밀면 다음 장, 오른쪽으로 밀면 이전 장. 짧게 밀거나 위아래로 밀면 그대로", () => {
    render(<OnboardingPage />);
    const 밀기 = (dx: number, dy = 0) => {
      const main = screen.getByRole("main");
      fireEvent.pointerDown(main, { clientX: 200, clientY: 300 });
      fireEvent.pointerUp(main, { clientX: 200 + dx, clientY: 300 + dy });
    };
    밀기(-120);
    expect(제목()).toMatch(/몇 가지 질문만/);
    밀기(-20);
    expect(제목()).toMatch(/몇 가지 질문만/);
    밀기(-60, 200);
    expect(제목()).toMatch(/몇 가지 질문만/);
    밀기(120);
    expect(제목()).toMatch(/흩어진 청년 혜택을/);
    밀기(120); // 1장에서 더 뒤로는 없다
    expect(제목()).toMatch(/흩어진 청년 혜택을/);
  });
});

describe("시작 화면 — 소개 마지막 장 (11/20)", () => {
  it("1 · 2장의 [건너뛰기]는 마지막 장으로 간다. 마지막 장에는 없다", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(마지막장);
    expect(screen.queryByRole("button", { name: "건너뛰기" })).toBeNull();
    expect(screen.getByRole("button", { name: "내 혜택 찾아보기" })).toBeTruthy();
  });

  it("[카카오로 로그인] · [내 혜택 찾아보기]는 마지막 장에만 — 카카오는 파랑 버튼 아래 (11/23)", async () => {
    enableLogin();
    const user = userEvent.setup();
    render(<OnboardingPage />);
    expect(screen.queryByRole("button", { name: /카카오로 로그인/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "내 혜택 찾아보기" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    const kakao = screen.getByRole("button", { name: /카카오로 로그인/ });
    const start = screen.getByRole("button", { name: "내 혜택 찾아보기" });
    // 문서 순서 = 화면 순서: 파랑(처음 온 사람)이 위, 카카오(회원)가 아래
    expect(start.compareDocumentPosition(kakao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("[카카오로 로그인]은 소개를 본 것으로 적고, 로그인 뒤 홈으로 돌아오게 한다", async () => {
    enableLogin();
    render(<StartPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /카카오로 로그인/ }));
    expect(signIn).toHaveBeenCalledWith("/home");
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("[내 혜택 찾아보기]는 지금처럼 질문으로", async () => {
    render(<StartPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "내 혜택 찾아보기" }));
    expect(routerMock.replace).toHaveBeenCalledWith("/find");
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("로그인을 쓸 수 없는 주소(미리 보기)에서는 카카오 버튼이 없다", () => {
    render(<StartPage />);
    expect(screen.queryByRole("button", { name: /카카오로 로그인/ })).toBeNull();
    expect(screen.getByRole("button", { name: "내 혜택 찾아보기" })).toBeTruthy();
  });

  it("이 기기에 로그인 기록이 있으면 카카오 버튼을 뺀다", async () => {
    enableLogin();
    signInAs("sub-a");
    render(<StartPage />);
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /카카오로 로그인/ })).toBeNull());
  });

  it("/start 는 처음부터 마지막 장이고, 진행 점으로 소개를 다시 볼 수 있다", async () => {
    render(<StartPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(마지막장);
    await userEvent.setup().click(screen.getByRole("button", { name: "2단계 · 안내" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/몇 가지 질문만\s*답하면 돼요/);
  });
});
