// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "@/app/components";
import { ENTRY_KEY } from "@/lib/entry";
import { resetNavigation, routerMock } from "./navigation-mock";

/**
 * 왼쪽 위 화살표 = 휴대폰 뒤로가기 (docs/기획/2026-11-03-단계-이동-설계.md).
 * 예전에는 화살표가 정해진 화면으로 새로 이동해(router.push·Link) 기록이 쌓였고,
 * 그 뒤 브라우저 뒤로가기가 방금 떠난 화면으로 되돌아갔다.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TopBar 뒤로가기", () => {
  it("문구는 화면과 상관없이 '이전 단계로' 하나다", () => {
    render(<TopBar backHref="/eligibility" backLabel="조건 입력으로 돌아가기" />);

    expect(screen.getByRole("button", { name: "이전 단계로" })).toBeTruthy();
    expect(screen.queryByLabelText("조건 입력으로 돌아가기")).toBeNull();
  });

  it("화살표는 링크가 아니라 버튼이다 — 새로 이동하지 않는다", () => {
    render(<TopBar backHref="/find/result" />);
    expect(screen.queryByRole("link", { name: "이전 단계로" })).toBeNull();
  });

  it("backHref 가 없으면 화살표 없이 자리만 잡는다", () => {
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: "이전 단계로" })).toBeNull();
  });

  it("앞 화면이 이 앱 안이면 history.back()", async () => {
    resetNavigation("/find/policies", "/find?q=birth");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<TopBar backHref="/find/result" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "이전 단계로" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("이 탭의 첫 화면이면 backHref 로 가고, 그 화면이 새 첫 화면이 된다", async () => {
    resetNavigation("/find/policies");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<TopBar backHref="/find/result" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "이전 단계로" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/find/result");
    expect(back).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find/result");
  });

  it("sessionStorage 가 막혀 있으면 앱 밖으로 튕기지 않게 backHref 로 간다", async () => {
    resetNavigation("/find/policies", "/find?q=birth");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<TopBar backHref="/find/result" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "이전 단계로" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/find/result");
  });

  it("화살표는 44px 터치 타깃이다", () => {
    render(<TopBar backHref="/find/result" />);
    expect(screen.getByRole("button", { name: "이전 단계로" }).className).toContain("h-11");
  });
});
