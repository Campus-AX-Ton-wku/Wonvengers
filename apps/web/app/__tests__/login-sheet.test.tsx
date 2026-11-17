// @vitest-environment jsdom
import type { MouseEvent, ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
 * 결과 화면 → 정책 목록은 로그인 없이 간다. 목록의 "지원받으면 내 월세는 얼마일까?"를 누르면
 * 로그인 시트가 뜨고 [로그인 없이 보기]는 없다. 닫으면 목록에 그대로 머물고, 다음에 누르면 다시 뜬다.
 */

const 익산_대학생 = {
  birthDate: birthDateForAge(24),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const 시트 = { name: "로그인하고 계산해 볼까요?" };

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
  return screen.findByRole("link", { name: /내 월세는 얼마일까/ });
}

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

describe("월세 계산 전 로그인 시트", () => {
  it("로그인하지 않았으면 계산 화면 대신 시트를 띄운다 — 카카오 버튼에 포커스, [로그인 없이 보기]는 없다", async () => {
    const user = userEvent.setup();
    await user.click(await 목록열기());

    const sheet = screen.getByRole("dialog", 시트);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(within(sheet).getByRole("button", { name: "카카오로 계속하기" }));
    expect(within(sheet).queryByRole("button", { name: /로그인 없이/ })).toBeNull();
  });

  it("'카카오로 계속하기'는 로그인 뒤 계산 화면으로 오게 한다", async () => {
    const user = userEvent.setup();
    await user.click(await 목록열기());
    await user.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(signIn).toHaveBeenCalledWith("/calculate");
  });

  it("닫으면 목록에 머물고 계산 화면으로 가지 않는다 — 다음에 누르면 다시 뜬다", async () => {
    const user = userEvent.setup();
    const cta = await 목록열기();
    await user.click(cta);
    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();

    await user.click(cta);
    expect(screen.getByRole("dialog", 시트)).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(document.activeElement).toBe(cta);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("'카카오로 계속하기'는 누르는 동안 막혀 두 번 가지 않는다", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await user.click(await 목록열기());
    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    await user.click(button);
    await user.click(button);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("로그인을 시작하지 못하면 시트 안에서 짧게 알리고 다시 누를 수 있다", async () => {
    vi.mocked(signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    await user.click(await 목록열기());
    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    await user.click(button);

    expect((await screen.findByRole("alert")).textContent).toBe("지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("로그인 상태면 띄우지 않고 바로 계산 화면으로 간다", async () => {
    signInAs("sub-a", { consent: false });
    const user = userEvent.setup();
    await user.click(await 목록열기());

    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/calculate");
  });

  it("로그인을 쓸 수 없는 빌드면 띄우지 않고 바로 계산 화면으로 간다", async () => {
    vi.unstubAllEnvs();
    const user = userEvent.setup();
    await user.click(await 목록열기());

    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/calculate");
  });
});
