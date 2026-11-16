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

import FindResultPage from "@/app/find/result/page";
import { signIn } from "@/lib/auth";
import { saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";
import { routerMock } from "./navigation-mock";

const 익산_대학생 = {
  birthDate: birthDateForAge(24),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const 시트 = { name: "이 결과를 저장해 둘까요?" };

// find-result.test.tsx 와 같은 날: 이사비·주거급여 분리지급·익산 전입 지원 2건, 모두 4건이 접수 중이라 "지원금 4건 자세히 보기" 가 뜬다.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-02-02T12:00:00+09:00"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  vi.mocked(signIn).mockReset();
  enableLogin();
});
afterEach(() => vi.unstubAllEnvs());

async function 결과열기() {
  saveAnswers(익산_대학생);
  render(<FindResultPage />);
  return screen.findByRole("link", { name: /지원금 4건 자세히 보기/ });
}

describe("가입 제안 시트 (설계 '화면' 1)", () => {
  it("처음 누르면 목록 대신 닫을 수 있는 시트를 띄운다 — 카카오 버튼에 포커스", async () => {
    const user = userEvent.setup();
    await user.click(await 결과열기());

    const sheet = screen.getByRole("dialog", 시트);
    expect(sheet.textContent).toContain("카카오로 3초 만에 저장하고, 다른 기기에서도 이어 보세요.");
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(within(sheet).getByRole("button", { name: "카카오로 계속하기" }));
  });

  it("Esc 로 닫으면 CTA 로 포커스가 돌아오고, 이 기기에서는 다시 띄우지 않는다", async () => {
    const user = userEvent.setup();
    const cta = await 결과열기();
    await user.click(cta);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(document.activeElement).toBe(cta);
    expect(window.localStorage.getItem("perky.signup-dismissed")).toBe("1");

    await user.click(cta);
    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/find/policies");
  });

  it("'로그인 없이 보기'는 바로 목록으로 가고 다시 띄우지 않는다", async () => {
    const user = userEvent.setup();
    await user.click(await 결과열기());
    await user.click(screen.getByRole("button", { name: "로그인 없이 보기" }));

    expect(routerMock.push).toHaveBeenCalledWith("/find/policies");
    expect(window.localStorage.getItem("perky.signup-dismissed")).toBe("1");
  });

  it("'카카오로 계속하기'는 로그인 뒤 목록으로 돌아오게 하고, 닫음으로 치지 않는다", async () => {
    const user = userEvent.setup();
    await user.click(await 결과열기());
    await user.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(signIn).toHaveBeenCalledWith("/find/policies");
    expect(window.localStorage.getItem("perky.signup-dismissed")).toBeNull();
  });

  it("'카카오로 계속하기'는 누르는 동안 막혀 두 번 가지 않는다", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await user.click(await 결과열기());
    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    await user.click(button);
    await user.click(button);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("로그인을 시작하지 못하면 시트 안에서 짧게 알리고 다시 누를 수 있다", async () => {
    vi.mocked(signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    await user.click(await 결과열기());
    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    await user.click(button);

    expect((await screen.findByRole("alert")).textContent).toBe("지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("로그인 상태면 띄우지 않는다", async () => {
    signInAs("sub-a", { consent: false });
    const user = userEvent.setup();
    await user.click(await 결과열기());

    expect(screen.queryByRole("dialog", 시트)).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/find/policies");
  });
});
