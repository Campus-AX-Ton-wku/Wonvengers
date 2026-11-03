// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoiceCard } from "@/app/components";

/** "선택된 부분 하이라이트" (2026-10-23 멘토링) — 선택 안 된 카드와의 대비. */
describe("ChoiceCard", () => {
  it("선택 안 된 카드에도 옅은 테두리가 있다", () => {
    render(<ChoiceCard active={false} onClick={() => {}}>아니다</ChoiceCard>);
    const card = screen.getByRole("button", { name: "아니다" });

    expect(card.className).toContain("ring-1");
    expect(card.className).toContain("ring-ink-200");
    expect(card.getAttribute("aria-pressed")).toBe("false");
  });

  it("선택된 카드는 진한 테두리 + 옅은 파랑 면이다", () => {
    render(<ChoiceCard active onClick={() => {}}>그렇다</ChoiceCard>);
    const card = screen.getByRole("button", { name: "그렇다" });

    expect(card.className).toContain("ring-2");
    expect(card.className).toContain("ring-brand-600");
    expect(card.className).toContain("bg-brand-50");
    expect(card.getAttribute("aria-pressed")).toBe("true");
  });
});
