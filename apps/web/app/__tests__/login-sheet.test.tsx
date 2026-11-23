// @vitest-environment jsdom
import type { MouseEvent, ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * next/link 대역: 누르면 routerMock.push(href). 화면의 onClick 이 preventDefault 하면 이동하지 않는다 —
 * 진짜 Link 와 같은 규칙이다. 진짜 Link 는 앱 라우터 컨텍스트 밖에서 이동하지 못한다.
 */
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  const { routerMock } = await import("./navigation-mock");
  return {
    default: function Link({
      href,
      onClick,
      children,
      className,
    }: {
      href: string;
      onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
      children?: ReactNode;
      className?: string;
    }) {
      return createElement(
        "a",
        {
          href,
          className,
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            routerMock.push(href);
          },
        },
        children
      );
    },
  };
});
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(),
}));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import FindPoliciesPage from "@/app/find/policies/page";
import FindResultPage from "@/app/find/result/page";
import { signIn } from "@/lib/auth";
import { saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";
import { routerMock } from "./navigation-mock";

/**
 * 로그인은 월세 계산 직전에 (11/17 팀 결정 — 손필기 ①②).
 * 결과 화면 → 정책 목록은 로그인 없이 간다.
 *
 * 목록에서 비회원의 계산 입구는 하단의 [카카오로 로그인하고 내 최종 주거비 확인하기] 하나다(11/23 ggue).
 * 예전에는 본문의 파란 "지원받으면 내 월세는 얼마일까?"가 로그인 시트를 띄우고, 그 위를 하단의
 * [카카오로 로그인하고 홈으로]가 덮고 있었다 — 둘 다 결국 카카오 로그인이라 하나로 합쳤다.
 * (파일 이름은 그대로 둔다 — 로그인 시트 자체는 저장 버튼 · 온보딩에서 계속 쓴다.)
 */

const 익산_대학생 = {
  birthDate: birthDateForAge(24),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

// 접수 중인 지원금이 있는 날로 고정한다(국토부 · 익산형 청년월세 접수 기간 밖이어도 상시 사업이 있다).
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-02-02T12:00:00+09:00"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  vi.mocked(signIn).mockReset();
  routerMock.push.mockClear();
  window.localStorage.clear();
  enableLogin();
});
afterEach(() => vi.unstubAllEnvs());

async function 목록열기() {
  saveAnswers(익산_대학생);
  render(<FindPoliciesPage />);
  await screen.findByRole("heading", { level: 1 });
}

const 합친버튼 = { name: /카카오로 로그인하고\s*내 최종 주거비 확인하기/ };

describe("결과 화면 → 목록은 로그인 없이", () => {
  it("로그인하지 않았어도 '자세히 보기'는 시트 없이 바로 목록으로 간다", async () => {
    saveAnswers(익산_대학생);
    render(<FindResultPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: /자세히 보기/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/find/policies");
  });
});

describe("목록의 계산 입구 — 비회원은 카카오 버튼 하나 (11/23)", () => {
  it("파란 계산 버튼과 [카카오로 로그인하고 홈으로] 대신 [카카오로 로그인하고 내 최종 주거비 확인하기] 하나만 있다", async () => {
    await 목록열기();

    expect(screen.queryByRole("link", { name: /내 월세는 얼마일까/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /로그인하고 홈으로/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /카카오/ })).toHaveLength(1);
    expect(screen.getByRole("button", 합친버튼)).toBeTruthy();
  });

  it("누르면 시트 없이 바로 카카오 로그인 — 로그인 뒤 계산 화면으로 온다", async () => {
    const user = userEvent.setup();
    await 목록열기();
    await user.click(screen.getByRole("button", 합친버튼));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(signIn).toHaveBeenCalledWith("/calculate");
  });

  it("누르는 동안 막혀 두 번 가지 않는다", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await 목록열기();
    const button = screen.getByRole("button", 합친버튼);
    await user.click(button);
    await user.click(button);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("로그인을 시작하지 못하면 짧게 알리고 다시 누를 수 있다", async () => {
    vi.mocked(signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    await 목록열기();
    const button = screen.getByRole("button", 합친버튼);
    await user.click(button);

    expect((await screen.findByRole("alert")).textContent).toBe("지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("전세도 계산하니(11/23) 월세와 같이 버튼 하나로 합친다", async () => {
    saveAnswers({ ...익산_대학생, housingType: "전세" as const });
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("button", 합친버튼)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /카카오로 로그인하고 홈으로/ })).toBeNull();
  });

  it("로그인 상태면 파란 계산 버튼으로 바로 계산 화면에 간다", async () => {
    signInAs("sub-a", { consent: false });
    const user = userEvent.setup();
    await 목록열기();
    await user.click(screen.getByRole("link", { name: /내 월세는 얼마일까/ }));

    expect(screen.queryByRole("button", 합친버튼)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/calculate");
  });

  it("로그인을 쓸 수 없는 빌드면 파란 계산 버튼으로 바로 계산 화면에 간다", async () => {
    vi.unstubAllEnvs();
    const user = userEvent.setup();
    await 목록열기();
    await user.click(screen.getByRole("link", { name: /내 월세는 얼마일까/ }));

    expect(screen.queryByRole("button", 합친버튼)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/calculate");
  });
});
