// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EligibilityPage from "@/app/eligibility/page";
import CalculatePage from "@/app/calculate/page";
import { loadProfile, saveListing } from "@/lib/storage";
import { makeListing } from "@/lib/__tests__/fixtures";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => {
  const router = { push: pushMock, replace: vi.fn() };
  return { useRouter: () => router };
});

/**
 * 사용자 흐름에서 깨져 있던 세 가지를 고정한다.
 *
 * 1. /calculate 첫 스텝의 뒤로가기가 아무 일도 하지 않았다 (앱바 화살표는 보인다).
 * 2. /eligibility 첫 스텝의 뒤로가기가 직전 화면이 아니라 홈으로 나갔다.
 * 3. 숫자 질문의 '모름' 을 켰다 끄면 값이 0 이 됐다. 소득 0원은 모든 소득 상한을
 *    통과해 '예상 적용' 으로 판정된다 — 실수로 두 번 누른 사람이 틀린 금액을 받는다.
 */

beforeEach(() => {
  pushMock.mockClear();
  saveListing(makeListing({ region: "전북특별자치도 익산시" }));
});

describe("뒤로가기", () => {
  it("계약 조건 첫 스텝에서 뒤로가면 1층 목록으로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(pushMock).toHaveBeenCalledWith("/find/policies");
  });

  it("판정 질문 첫 스텝에서 뒤로가면 계약 조건으로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<EligibilityPage />);
    await screen.findByLabelText("이전 단계로");

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(pushMock).toHaveBeenCalledWith("/calculate");
  });
});

/** 생년월일은 년/월/일 목록 세 개다. */
async function pickBirthDate(
  user: ReturnType<typeof userEvent.setup>,
  year: number,
  month: number,
  day: number
) {
  await user.selectOptions(screen.getByLabelText("생년월일"), String(year));
  await user.selectOptions(screen.getByLabelText("생년월일 월"), String(month));
  await user.selectOptions(screen.getByLabelText("생년월일 일"), String(day));
}

/**
 * <input type="date"> 는 오늘(2026)부터 시작해서 청년이 19년을 거슬러 올라가야 했다.
 * 목록 맨 위가 만 18세 생년이라 한두 번만 굴리면 닿는다.
 */
describe("생년월일 선택", () => {
  async function openFirstStep() {
    render(<EligibilityPage />);
    await screen.findByLabelText("이전 단계로");
  }

  it("목록 맨 위가 올해가 아니라 청년 생년대다", async () => {
    await openFirstStep();
    const years = Array.from((screen.getByLabelText("생년월일") as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter(Boolean);

    expect(years[0]).toBe(String(new Date().getFullYear() - 18));
    expect(years).not.toContain(String(new Date().getFullYear()));
  });

  it("세 칸을 다 골라야 넘어간다 — 반쯤 고른 상태는 날짜가 아니다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    await user.selectOptions(screen.getByLabelText("생년월일"), "2003");
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("생년월일을 입력해주세요.")).toBeTruthy();

    await pickBirthDate(user, 2003, 8, 12);
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(loadProfile()?.birthDate).toBe("2003-08-12");
  });

  // 3월 31일을 고른 뒤 2월로 바꾸면 2월 31일이 남으면 안 된다.
  it("없는 날짜가 남지 않게 자른다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    await pickBirthDate(user, 2003, 3, 31);
    await user.selectOptions(screen.getByLabelText("생년월일 월"), "2");
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(loadProfile()?.birthDate).toBe("2003-02-28");
  });
});

describe("숫자 질문의 '모름'", () => {
  /** 가구원 수 · 소득처럼 숫자를 받는 칸들 */
  const numberInputs = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];

  async function goToIncomeStep(user: ReturnType<typeof userEvent.setup>) {
    render(<EligibilityPage />);
    await screen.findByLabelText("이전 단계로");
    // 1번 스텝(기본 자격)에는 생년월일이 있어 넘어가려면 채워야 한다
    await pickBirthDate(user, 2003, 8, 12);
    await user.click(screen.getByRole("button", { name: "다음" }));
  }

  it("'모름' 을 누르면 칸이 비고, 저장된 값도 모름이다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    const input = numberInputs()[0];
    await user.type(input, "1500000");
    expect(input.value).toBe("1500000");

    await user.click(screen.getAllByRole("button", { name: "모름" })[0]);
    expect(numberInputs()[0].value).toBe("");
  });

  // 이게 버그였다: 모름을 두 번 누르면 0 이 되어 조용히 통과했다.
  it("'모름' 을 두 번 눌러도 0 이 되지 않는다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    const 모름 = screen.getAllByRole("button", { name: "모름" })[0];
    await user.click(모름);
    await user.click(모름);

    expect(numberInputs()[0].value).toBe("");
    await user.click(screen.getByRole("button", { name: /다음|결과 확인하기/ }));
    expect(loadProfile()?.householdSize).toBe("unknown");
  });

  it("칸을 지우면 다시 모름이 된다 — 빈 칸이 0 으로 저장되지 않는다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    const input = numberInputs()[0];
    await user.type(input, "3");
    await user.clear(input);

    await user.click(screen.getByRole("button", { name: /다음|결과 확인하기/ }));
    expect(loadProfile()?.householdSize).toBe("unknown");
  });

  it("숫자를 입력하면 모름이 풀리고 그 값이 저장된다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    await user.type(numberInputs()[0], "2");
    await user.click(screen.getByRole("button", { name: /다음|결과 확인하기/ }));
    expect(loadProfile()?.householdSize).toBe(2);
  });

  // 가구원 수는 그대로 세지만, 소득은 만원 단위로 받는다.
  it("소득 칸은 만원으로 받고 원으로 저장한다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    await user.type(screen.getByLabelText("본인 가구의 월 소득 (만원)"), "150");
    expect(screen.getByText("150만원")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /다음|결과 확인하기/ }));
    expect(loadProfile()?.ownHouseholdMonthlyIncome).toBe(1_500_000);
  });

  it("'모르면 비워두세요' 안내를 지웠다 — 밑에 '모름' 버튼이 있다", async () => {
    const user = userEvent.setup();
    await goToIncomeStep(user);

    expect(numberInputs()[0].getAttribute("placeholder")).toBeNull();
    expect(screen.getAllByRole("button", { name: "모름" }).length).toBeGreaterThan(0);
  });
});
