// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

/**
 * 생년월일은 휠 데이트 피커다 — 트리거를 열고, 컬럼에서 고르고, '확인' 을 눌러야
 * 값이 올라간다. jsdom 에서는 스크롤을 흉내낼 수 없으므로 항목을 직접 클릭한다.
 * (스크롤 위치 ↔ 인덱스 계산은 lib/__tests__/wheel.test.ts 가 덮는다.)
 */
const 생년월일칸 = (part: string) =>
  screen.getByRole("listbox", { name: `생년월일 ${part}` });

async function openBirthWheel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^생년월일 —/ }));
}

/** 패널이 이미 열려 있을 때 세 칸을 고른다. 트리거는 토글이라 다시 누르면 닫힌다. */
async function pickParts(
  user: ReturnType<typeof userEvent.setup>,
  year: number,
  month: number,
  day: number
) {
  await user.click(within(생년월일칸("년")).getByRole("option", { name: `${year}년` }));
  await user.click(within(생년월일칸("월")).getByRole("option", { name: `${month}월` }));
  await user.click(within(생년월일칸("일")).getByRole("option", { name: `${day}일` }));
}

const 확인 = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "확인" }));

async function pickBirthDate(
  user: ReturnType<typeof userEvent.setup>,
  year: number,
  month: number,
  day: number
) {
  await openBirthWheel(user);
  await pickParts(user, year, month, day);
  await 확인(user);
}

/**
 * <input type="date"> 는 오늘(2026)부터 시작해서 청년이 19년을 거슬러 올라가야 했다.
 * 목록 맨 위가 만 18세 생년이라 한두 번만 굴리면 닿는다.
 */
describe("생년월일 선택 (휠 피커)", () => {
  async function openFirstStep() {
    render(<EligibilityPage />);
    await screen.findByLabelText("이전 단계로");
  }

  it("연도 목록 맨 위가 올해가 아니라 청년 생년대다", async () => {
    const user = userEvent.setup();
    await openFirstStep();
    await openBirthWheel(user);

    const years = within(생년월일칸("년"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    const now = new Date().getFullYear();
    expect(years[0]).toBe(`${now - 18}년`);
    expect(years).not.toContain(`${now}년`);
  });

  // 휠은 항상 무언가를 가리킨다. 확인 전에 값이 새면 손대지 않은 사람도 날짜를 제출한다.
  it("'확인' 을 누르기 전에는 저장되지 않는다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    await openBirthWheel(user);
    await user.click(within(생년월일칸("년")).getByRole("option", { name: "2003년" }));
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("생년월일을 입력해주세요.")).toBeTruthy();

    // 에러가 떠도 패널은 열려 있다 — 다시 누르면 토글로 닫힌다
    await pickParts(user, 2003, 8, 12);
    await 확인(user);
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(loadProfile()?.birthDate).toBe("2003-08-12");
  });

  // 3월 31일을 고른 뒤 2월로 바꾸면 2월 31일이 남으면 안 된다.
  it("없는 날짜가 남지 않게 자른다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    await openBirthWheel(user);
    await user.click(within(생년월일칸("년")).getByRole("option", { name: "2003년" }));
    await user.click(within(생년월일칸("월")).getByRole("option", { name: "3월" }));
    await user.click(within(생년월일칸("일")).getByRole("option", { name: "31일" }));
    await user.click(within(생년월일칸("월")).getByRole("option", { name: "2월" }));
    await user.click(screen.getByRole("button", { name: "확인" }));
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(loadProfile()?.birthDate).toBe("2003-02-28");
  });

  it("고른 날짜를 트리거 버튼에 그대로 보여준다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    expect(screen.getByRole("button", { name: "생년월일 — 선택 안 함" })).toBeTruthy();
    await pickBirthDate(user, 2003, 8, 12);
    expect(screen.getByRole("button", { name: "생년월일 — 2003년 8월 12일" })).toBeTruthy();
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
