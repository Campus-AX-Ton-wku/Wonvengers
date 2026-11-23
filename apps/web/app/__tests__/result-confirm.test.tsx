// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmPage from "@/app/result/confirm/page";
import { confirmKey } from "@/lib/confirm";
import { loadDeclared, saveDeclared, saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { resetNavigation, routerMock } from "./navigation-mock";

/**
 * 결과 전 '확인할 것' (11/23 ggue) — 금액이 걸린 모르는 조건을 결과 전에 반드시 '해당해요' · '해당하지 않아요'로.
 */
const 주거급여 = "youth-housing-benefit-split-payment";
const 원가구키 = confirmKey(주거급여, "originHouseholdIncome");

beforeEach(() => {
  resetNavigation("/result/confirm");
  saveListing(makeListing({ contractType: "월세", rentOrYearlyAmount: 350_000, managementFee: 50_000, months: 12 }));
});

describe("/result/confirm", () => {
  it("확인할 것이 없으면 바로 결과로 넘긴다", async () => {
    saveProfile(makeProfile());
    render(<ConfirmPage />);
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/result"));
  });

  it("모르는 조건을 지원별로 보여 주고, 모두 답하기 전에는 [결과 보기]가 잠겨 있다 — '모름'은 없다", async () => {
    saveProfile(makeProfile({ originHouseholdMonthlyIncome: "unknown" }));
    render(<ConfirmPage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("이 조건만 확인해 주세요");
    const card = screen.getByRole("region", { name: "청년 주거급여 분리지급" });
    expect(within(card).getByText(/해당하면 예상/).textContent).toContain("254만 4,000원");
    const group = within(card).getByRole("radiogroup", { name: /원가구 소득.*해당하나요/ });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["해당해요", "해당하지 않아요"]);
    expect(screen.queryByRole("radio", { name: /모름/ })).toBeNull();
    expect((screen.getByRole("button", { name: "결과 보기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/모두 답해야 결과를 볼 수 있어요/)).toBeTruthy();
  });

  it("다 답하면 답을 저장하고 결과로 넘긴다 (뒤로 가면 판정 질문)", async () => {
    const user = userEvent.setup();
    saveProfile(makeProfile({ originHouseholdMonthlyIncome: "unknown" }));
    render(<ConfirmPage />);
    const card = await screen.findByRole("region", { name: "청년 주거급여 분리지급" });
    await user.click(within(card).getByRole("radio", { name: "해당해요" }));
    await user.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(loadDeclared()[원가구키]).toBe(true);
    expect(routerMock.replace).toHaveBeenCalledWith("/result");
  });

  it("이미 답한 조건도 고칠 수 있게 보여 준다 — '해당하지 않아요'로 빠진 지원도", async () => {
    const user = userEvent.setup();
    saveProfile(makeProfile({ originHouseholdMonthlyIncome: "unknown" }));
    saveDeclared(원가구키, false);
    render(<ConfirmPage />);
    const card = await screen.findByRole("region", { name: "청년 주거급여 분리지급" });
    expect(within(card).getByRole("radio", { name: "해당하지 않아요" }).getAttribute("aria-checked")).toBe("true");
    await user.click(within(card).getByRole("radio", { name: "해당해요" }));
    await user.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(loadDeclared()[원가구키]).toBe(true);
  });
});
