// @vitest-environment jsdom
import type { MouseEvent, ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Global Constraint: 웹 환경변수(NEXT_PUBLIC_COGNITO_DOMAIN·CLIENT_ID·API_URL)가 없으면 로그인 UI 를
 * 그리지 않고 앱은 오늘과 똑같이 동작한다. 배포 전 빌드와 테스트 환경이 이 상태다.
 * 예전 로그인·동의 기록이 남아 있어도(환경변수만 빠진 빌드) 서버를 부르지 않는다.
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

import AccountPage from "@/app/account/page";
import AuthCallbackPage from "@/app/auth/callback/page";
import ConsentPage from "@/app/auth/consent/page";
import FindPoliciesPage from "@/app/find/policies/page";
import FindResultPage from "@/app/find/result/page";
import { resetAuthForTests } from "@/lib/auth";
import { readLocalContent, saveAnswers } from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import { emptyContent } from "@/lib/user-data";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";
import { resetNavigation, routerMock } from "./navigation-mock";

const fetchSpy = vi.fn<typeof fetch>();
const 익산_대학생 = {
  birthDate: birthDateForAge(24),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-02-02T12:00:00+09:00"));
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockReset();
  signInAs("sub-a");
  seedSyncMeta("sub-a", { dirty: true });
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllGlobals();
});

describe("로그인을 쓸 수 없을 때(환경변수 없음) — 오늘과 똑같이", () => {
  it("/find/result: 시트 없이 바로 목록으로", async () => {
    saveAnswers(익산_대학생);
    render(<FindResultPage />);
    await userEvent.setup().click(await screen.findByRole("link", { name: /지원금 2건 자세히 보기/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith("/find/policies");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("상단바에 계정 칸이 없고, 답을 고쳐도 서버를 부르지 않는다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });
    saveAnswers({ ...익산_대학생, housingType: "전세" });

    expect(screen.queryByRole("link", { name: /내 계정/ })).toBeNull();
    await new Promise((r) => setTimeout(r, 1600));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("'처음부터 다시'는 서버 없이 그대로 동작한다", async () => {
    saveAnswers(익산_대학생);
    resetNavigation("/find/policies", "/find?q=birth");
    render(<FindPoliciesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "처음부터 다시" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "다시 하기" }));

    expect(readLocalContent()).toEqual(emptyContent());
    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=birth");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  for (const [path, Page] of [
    ["/auth/callback", AuthCallbackPage],
    ["/auth/consent", ConsentPage],
    ["/account", AccountPage],
  ] as const) {
    it(`${path}: 지금은 로그인을 쓸 수 없다고만 말한다`, async () => {
      render(<Page />);
      expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("지금은 로그인을 쓸 수 없어요");
      expect(screen.queryByRole("button", { name: "카카오로 계속하기" })).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});
