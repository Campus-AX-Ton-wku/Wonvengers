// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerSummaryBar } from "@/app/components";
import { routerMock } from "./navigation-mock";

/**
 * 고른 답은 상단바 바로 아래 한 줄에 둔다 (docs/기획/2026-11-03-단계-이동-설계.md).
 * 예전에는 현재 질문 아래로 쌓여서 시군구·소득처럼 목록이 긴 단계에서 화면 밖으로 밀렸다.
 */

const items = [
  { key: "birthDate", label: "생년월일", value: "만 23세", href: "/find?q=birth" },
  { key: "region", label: "사는 곳", value: "부산 중구", href: "/find?q=region&p=%EB%B6%80%EC%82%B0" },
];

describe("AnswerSummaryBar", () => {
  it("값만 · 로 잇는다", () => {
    render(<AnswerSummaryBar items={items} />);
    expect(screen.getByRole("navigation", { name: "고른 답" }).textContent).toBe("만 23세·부산 중구");
  });

  it("각 항목은 그 단계로 가는 링크다 — 누르면 router.push, 기록에 남는다", async () => {
    render(<AnswerSummaryBar items={items} />);
    const link = screen.getByRole("link", { name: "사는 곳 고치기: 부산 중구" });

    expect(link.getAttribute("href")).toBe(items[1].href);
    await userEvent.setup().click(link);
    expect(routerMock.push).toHaveBeenCalledWith(items[1].href);
  });

  it("항목도 lead 도 없으면 그리지 않는다", () => {
    const { container } = render(<AnswerSummaryBar items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("lead 는 항목 앞에 붙는다 — 항목이 없어도 lead 가 있으면 그린다", () => {
    render(<AnswerSummaryBar items={[]} lead={<span>1/3 기본 자격</span>} />);
    expect(screen.getByRole("navigation", { name: "고른 답" }).textContent).toBe("1/3 기본 자격");
  });

  it("한 줄을 넘으면 줄바꿈하지 않고 가로로 스크롤한다(스크롤바 숨김)", () => {
    render(<AnswerSummaryBar items={items} />);
    const list = screen.getByRole("list");
    for (const cls of ["overflow-x-auto", "whitespace-nowrap", "no-scrollbar"]) {
      expect(list.className, cls).toContain(cls);
    }
  });

  it("상단바와 함께 고정되고, 항목은 44px 터치 타깃이다", () => {
    render(<AnswerSummaryBar items={items} />);
    expect(screen.getByRole("navigation", { name: "고른 답" }).className).toContain("sticky");
    for (const link of screen.getAllByRole("link")) expect(link.className).toContain("min-h-11");
  });
});
