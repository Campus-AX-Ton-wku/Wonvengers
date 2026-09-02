// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultLoading, ResultState } from "@/app/result/ResultState";

describe("결과 예외 상태", () => {
  it("로딩 중에는 실제 금액 대신 진행 상태와 skeleton을 알린다", () => {
    render(<ResultLoading />);

    expect(screen.getByRole("status").textContent).toBe("혜택 계산 중");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText(/만원|억원/)).toBeNull();
  });

  it("빈 결과에서 정보 수정과 전체 혜택 경로를 제공한다", () => {
    render(<ResultState kind="empty" />);

    expect(screen.getByRole("link", { name: "내 정보 수정하기" }).getAttribute("href")).toBe("/eligibility");
    expect(screen.getByRole("link", { name: "전체 혜택 둘러보기" }).getAttribute("href")).toBe("/find/policies");
  });

  it("오류 재시도는 입력을 버리는 경로 이동 대신 전달받은 동작을 실행한다", () => {
    const retry = vi.fn();
    render(<ResultState kind="error" onRetry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/입력한 내용은 그대로 보관/)).toBeTruthy();
  });

  it("마감 상태는 실제 종료일을 표시하고 값이 없으면 임의 날짜를 만들지 않는다", () => {
    const { rerender } = render(<ResultState kind="expired" endDate="2026-09-30" />);
    expect(screen.getByText("종료일 · 2026.09.30")).toBeTruthy();

    rerender(<ResultState kind="expired" />);
    expect(screen.getByText("종료일 정보 없음")).toBeTruthy();
  });
});
