// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingPage from "@/app/onboarding/page";

describe("온보딩 2장", () => {
  it("질문 수를 실제와 같게 말한다 — /find 는 다섯 가지를 묻는다", async () => {
    render(<OnboardingPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "2단계 · 안내" }));

    expect(screen.getByText(/다섯 가지만 답하면 됩니다/)).toBeTruthy();
    expect(screen.getByText(/주거 형태/)).toBeTruthy();
    expect(screen.queryByText(/네 가지/)).toBeNull();
  });
});
