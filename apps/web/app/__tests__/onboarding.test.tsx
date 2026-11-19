// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(() => Promise.resolve()),
}));

import OnboardingPage from "@/app/onboarding/page";
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

describe("온보딩 2장", () => {
  it("질문 수를 실제와 같게 말한다 — /find 는 다섯 가지를 묻는다", async () => {
    render(<OnboardingPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "2단계 · 안내" }));

    expect(screen.getByText(/다섯 가지만 답하면 됩니다/)).toBeTruthy();
    expect(screen.getByText(/주거 형태/)).toBeTruthy();
    expect(screen.queryByText(/네 가지/)).toBeNull();
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

  it("로그인을 쓸 수 있으면 마지막 장에만 [카카오로 로그인] — 파랑 버튼 아래", async () => {
    enableLogin();
    const user = userEvent.setup();
    render(<OnboardingPage />);
    expect(screen.queryByRole("button", { name: /카카오로 로그인/ })).toBeNull();
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

  it("/start 는 처음부터 마지막 장이고, [이전]으로 소개를 다시 볼 수 있다", async () => {
    render(<StartPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(마지막장);
    await userEvent.setup().click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/나에게 맞는 혜택/);
  });
});
