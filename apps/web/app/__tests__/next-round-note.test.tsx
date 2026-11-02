// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRoundNote } from "@/app/find/policies/[id]/PolicyDetail";

describe("마감 정책의 다음 회차", () => {
  it("확인된 다음 일정과 어떻게 확인했는지를 함께 말한다", () => {
    render(<NextRoundNote nextRound={{ text: "2027년 4월 공고 예정", confirmedAt: "2026-11-05", via: "전화" }} />);

    expect(screen.getByText("2027년 4월 공고 예정 · 2026.11.05 전화 확인")).toBeTruthy();
  });

  it("확인 못 했으면 그리지 않는다 — 다음 회차를 지어내지 않는다", () => {
    const { container } = render(<NextRoundNote nextRound={null} />);

    expect(container.innerHTML).toBe("");
  });
});
