// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EligibilityPage from "@/app/eligibility/page";
import CalculatePage from "@/app/calculate/page";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  loadProfile,
  saveAnswers,
  saveListing,
  saveProfile,
} from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { resetNavigation, routerMock } from "./navigation-mock";

/**
 * 사용자 흐름에서 깨져 있던 세 가지를 고정한다.
 *
 * 1. /calculate 첫 스텝의 뒤로가기가 아무 일도 하지 않았다 (앱바 화살표는 보인다).
 * 2. /eligibility 첫 스텝의 뒤로가기가 직전 화면이 아니라 홈으로 나갔다.
 * 3. 숫자 질문의 '모름' 을 켰다 끄면 값이 0 이 됐다. 소득 0원은 모든 소득 상한을
 *    통과해 '예상 적용' 으로 판정된다 — 실수로 두 번 누른 사람이 틀린 금액을 받는다.
 */

beforeEach(() => {
  resetNavigation("/eligibility");
  // 1층 답변이 테스트 사이로 새면 2층 생년월일 프리필이 앞 테스트에 물든다.
  window.localStorage.clear();
  saveListing(makeListing({ region: "전북특별자치도 익산시" }));
  Element.prototype.scrollIntoView = vi.fn();
});

describe("뒤로가기", () => {
  // 링크로 바로 들어온 사람(이 탭의 첫 화면). 앞 화면이 앱 안이면 history.back() 이다.
  it("계약 조건 첫 스텝에서 뒤로가면 1층 목록으로 돌아간다", async () => {
    resetNavigation("/calculate");
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(routerMock.replace).toHaveBeenCalledWith("/find/policies");
  });

  it("판정 질문 첫 스텝에서 뒤로가면 계약 조건으로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(routerMock.replace).toHaveBeenCalledWith("/calculate");
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
    await screen.findByRole("heading", { level: 1 });
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

  it("고른 날짜는 접힌 줄에 보이고, 누르면 트리거 버튼에 그대로 보인다", async () => {
    const user = userEvent.setup();
    await openFirstStep();

    expect(screen.getByRole("button", { name: "생년월일 — 선택 안 함" })).toBeTruthy();
    await pickBirthDate(user, 2003, 8, 12);
    await user.click(screen.getByRole("button", { name: "생년월일 고치기: 2003.08.12" }));
    expect(screen.getByRole("button", { name: "생년월일 — 2003년 8월 12일" })).toBeTruthy();
  });
});

/**
 * 1층도 생년월일을 받으므로 2층은 같은 걸 다시 묻지 않는다.
 *
 * 전에는 1층이 나이를 숫자로 받았다. 나이만으로는 정책 기준일의 만 나이를 낼 수
 * 없어서 2층이 생년월일을 또 물었고, 화면에 "앞에서 만 27세라고 답하셨어요…" 라는
 * 변명을 달아야 했다. 1층이 생년월일을 받는 지금은 그 질문 자체가 중복이다.
 */
describe("1층에서 받은 생년월일", () => {
  const 일층답변 = {
    birthDate: "2003-08-12",
    region: "전북특별자치도 익산시",
    status: "재직" as const,
    incomeBracket: 2,
    housingType: null,
  };

  it("1층에서 답한 생년월일이 채워진 채로 열린다", async () => {
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("button", { name: "생년월일 — 2003년 8월 12일" })).toBeTruthy();
  });

  it("손대지 않아도 그대로 넘어간다 — 같은 답을 두 번 하지 않는다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.queryByText("생년월일을 입력해주세요.")).toBeNull();
    expect(loadProfile()?.birthDate).toBe("2003-08-12");
  });

  it("왜 또 묻는지 변명하는 문구가 없다", async () => {
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByText(/앞에서 만 .*세라고 답하셨어요/)).toBeNull();
  });

  it("1층을 건너뛴 사람에게는 빈 채로 묻는다", async () => {
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("button", { name: "생년월일 — 선택 안 함" })).toBeTruthy();
  });

  // 2층을 하다 말고 1층으로 돌아가 생년월일을 채워 오는 경로. 저장된 프로필이
  // 그대로 이기면 빈 칸이 남아서, 방금 답하고 온 사람에게 또 묻게 된다.
  it("저장된 프로필의 생년월일이 비어 있으면 1층 답으로 채운다", async () => {
    saveProfile(makeProfile({ birthDate: "" }));
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("button", { name: "생년월일 — 2003년 8월 12일" })).toBeTruthy();
  });

  /*
   * 생년월일은 두 화면이 나눠 갖는 값이 아니라 하나다.
   *
   * 어느 쪽이 더 최근에 고쳐진 건지 알 방법이 없으므로 1층 답을 소스 오브 트루스로
   * 삼는다. 2층 프로필이 이기게 두면 이 경로가 깨진다 — 1층에서 답하고 2층에
   * 들렀다가, 다시 1층으로 돌아가 날짜를 고치고 오면 방금 고친 값이 안 뜬다.
   */
  it("1층에서 고쳐 오면 2층에 저장돼 있던 옛 값을 밀어낸다", async () => {
    saveProfile(makeProfile({ birthDate: "1999-05-05" })); // 2층에 남아 있던 옛 값
    saveAnswers(일층답변); // 1층에서 2003-08-12 로 고쳐 왔다
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("button", { name: "생년월일 — 2003년 8월 12일" })).toBeTruthy();
  });

  // 값이 하나이려면 2층에서 고친 것도 1층 답변에 들어가야 한다. 안 그러면 다음에
  // 2층에 들어올 때 1층의 옛 값이 다시 이겨서 방금 한 수정이 사라진다.
  it("2층에서 고치면 1층 답변에도 반영된다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await pickBirthDate(user, 1995, 7, 20);
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(loadAnswers().birthDate).toBe("1995-07-20");
    expect(loadProfile()?.birthDate).toBe("1995-07-20");
  });

  // 1층을 건너뛴 사람의 답변까지 만들어내면 안 된다 — 지역·상태·소득은 여전히 모름이다.
  it("2층 수정이 1층의 다른 답변을 건드리지 않는다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층답변);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await pickBirthDate(user, 1995, 7, 20);
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(loadAnswers().region).toBe("전북특별자치도 익산시");
    expect(loadAnswers().status).toBe("재직");
    expect(loadAnswers().incomeBracket).toBe(2);
  });
});

describe("숫자 질문의 '모름'", () => {
  /** 가구원 수 · 소득처럼 숫자를 받는 칸들 */
  const numberInputs = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];

  async function goToIncomeStep(user: ReturnType<typeof userEvent.setup>) {
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
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

describe("/eligibility 묶음 주소", () => {
  it("주소에 묶음이 없으면 ?g=1 로 replace 한다", async () => {
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(routerMock.replace).toHaveBeenCalledWith("/eligibility?g=1");
  });

  it("'다음' 은 다음 묶음 주소를 push 한다", async () => {
    const user = userEvent.setup();
    saveAnswers({ ...EMPTY_ANSWERS, birthDate: "2003-08-12" });
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(routerMock.push).toHaveBeenCalledWith("/eligibility?g=2");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("가구와 소득을 알려주세요");
  });

  it("생년월일 없이 ?g=3 으로 들어오면 첫 묶음으로 replace 한다", async () => {
    resetNavigation("/eligibility?g=3");
    render(<EligibilityPage />);

    expect(await screen.findByRole("heading", { name: "기본 자격을 확인할게요" })).toBeTruthy();
    expect(routerMock.replace).toHaveBeenCalledWith("/eligibility?g=1");
  });

  it("휴대폰 뒤로가기로 앞 묶음에 돌아온다", async () => {
    const user = userEvent.setup();
    saveAnswers({ ...EMPTY_ANSWERS, birthDate: "2003-08-12" });
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: "다음" }));

    window.history.back();

    expect(await screen.findByRole("heading", { name: "기본 자격을 확인할게요" })).toBeTruthy();
  });
});

describe("/eligibility 진행 표시·답 접기", () => {
  const 일층 = { ...EMPTY_ANSWERS, birthDate: "2003-08-12" };

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("요약 줄 앞에 '1/3 기본 자격' 처럼 어디쯤인지 말한다", async () => {
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("1/3 기본 자격")).toBeTruthy();
  });

  it("다음 묶음에서는 앞 묶음이 항목으로 남고, 누르면 그 묶음 주소로 간다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText("2/3 가구 · 소득")).toBeTruthy();
    const link = screen.getByRole("link", { name: "1단계 고치기: 기본 자격" });
    expect(link.getAttribute("href")).toBe("/eligibility?g=1");
  });

  it("예/아니오에 답하면 그 질문이 한 줄로 접히고, 누르면 다시 펼친다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    const 처음 = screen.getAllByRole("button", { name: "그렇다" }).length;

    await user.click(screen.getAllByRole("button", { name: "그렇다" })[0]);

    const 접힌줄 = screen.getByRole("button", { name: "부모와 따로 거주 고치기: 그렇다" });
    expect(screen.getAllByRole("button", { name: "그렇다" })).toHaveLength(처음 - 1);
    // 누른 선택지가 사라졌으므로 포커스는 접힌 줄로 옮긴다 — body 로 떨어지면 안 된다.
    expect(document.activeElement).toBe(접힌줄);

    await user.click(접힌줄);
    expect(screen.getAllByRole("button", { name: "그렇다" })).toHaveLength(처음);
  });

  it("접힌 줄을 눌러 펼치면 포커스가 그 질문 제목으로 간다 — body 로 떨어지면 안 된다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getAllByRole("button", { name: "그렇다" })[0]);
    await user.click(screen.getByRole("button", { name: "부모와 따로 거주 고치기: 그렇다" }));

    expect(document.activeElement).toBe(
      screen.getByText("부모와 별도로 거주하나요?", { selector: "label" })
    );
  });

  it("답하면 '다음' 없이도 저장된다 — 첫 묶음에서 화살표로 /calculate 에 가도 답이 남는다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getAllByRole("button", { name: "그렇다" })[0]);
    expect(loadProfile()?.livesApartFromParents).toBe(true);

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(routerMock.replace).toHaveBeenCalledWith("/calculate");
    expect(loadProfile()?.livesApartFromParents).toBe(true);
  });

  it("불러오기 전의 빈 프로필로 저장된 답을 덮지 않는다", async () => {
    saveAnswers(일층);
    saveProfile(makeProfile({ livesApartFromParents: false }));
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(loadProfile()?.livesApartFromParents).toBe(false);
  });

  it("질문 제목의 포커스 표시는 공용 focus-ring 이다 — 옅은 brand-100 링은 지면과 3:1 이 안 된다", async () => {
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    const title = screen.getByText("부모와 별도로 거주하나요?", { selector: "label" });
    expect(title.className).toContain("focus-ring");
    expect(title.className).not.toContain("ring-brand-100");
  });

  it("'모름' 도 답이다 — 고르면 접힌다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getAllByRole("button", { name: "모름" })[0]);
    expect(screen.getByRole("button", { name: "부모와 따로 거주 고치기: 모름" })).toBeTruthy();
  });

  it("숫자 칸은 치는 중에 접지 않는다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: "다음" }));

    await user.type(screen.getAllByRole("spinbutton")[0], "2");
    expect(screen.queryByRole("button", { name: /^가구원 수 고치기/ })).toBeNull();
  });

  it("답하면 다음 질문을 화면 가운데로 데려온다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    await user.click(screen.getAllByRole("button", { name: "그렇다" })[0]);

    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect((scroll.mock.contexts.at(-1) as HTMLElement).textContent).toContain(
      "해당 주소로 전입신고가 가능한가요?"
    );
  });

  it("움직임 줄이기 설정이면 즉시 스크롤한다", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getAllByRole("button", { name: "그렇다" })[0]);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("생년월일 없이 '다음' 을 누르면 그 질문으로 스크롤하고 제목에 포커스한다 — 아래 한 줄 오류도 남긴다", async () => {
    const user = userEvent.setup();
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(document.activeElement).toBe(screen.getByText("생년월일", { selector: "label" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText("생년월일을 입력해주세요.")).toBeTruthy();
  });
});

/**
 * 열기만 하고 떠난 사람의 저장소는 그대로여야 한다. 모두 '모름' 인 프로필이 저장되면
 * 정책 상세·결과 화면이 그 사람을 2층을 마친 사람으로 보고 모름투성이 판정을 보여준다.
 */
describe("/eligibility 열기만 하면 저장하지 않는다", () => {
  const 일층 = { ...EMPTY_ANSWERS, birthDate: "2003-08-12" };

  it("답하지 않고 화살표로 떠나면 프로필이 저장되지 않는다", async () => {
    const user = userEvent.setup();
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByLabelText("이전 단계로"));
    expect(routerMock.replace).toHaveBeenCalledWith("/calculate");
    expect(window.localStorage.getItem("housing-benefit:profile")).toBeNull();
  });

  it("1층 생년월일이 채워져 열려도, 답하지 않으면 프로필이 저장되지 않는다", async () => {
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(window.localStorage.getItem("housing-benefit:profile")).toBeNull();
    expect(loadAnswers()).toEqual(일층);
  });

  it("하나라도 답하면 그때부터 저장한다", async () => {
    const user = userEvent.setup();
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getAllByRole("button", { name: "아니다" })[0]);
    expect(loadProfile()?.livesApartFromParents).toBe(false);
  });

  it("저장된 프로필이 있던 사람은 지금처럼 계속 저장한다 — 1층에서 고친 생년월일이 바로 들어간다", async () => {
    saveProfile(makeProfile({ birthDate: "1999-05-05" }));
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(loadProfile()?.birthDate).toBe("2003-08-12");
  });
});

/**
 * 손대지 않은 질문의 값은 판정상 '모름' 이지만, 화면에서는 아무것도 고르지 않은 상태다.
 * 예전에는 기본값이 'unknown' 이라 '모름' 카드가 고른 것처럼 칠해져 있었다.
 */
describe("/eligibility 고르기 전에는 아무 카드도 선택돼 보이지 않는다", () => {
  const 일층 = { ...EMPTY_ANSWERS, birthDate: "2003-08-12" };
  const 질문칸 = (label: string) =>
    screen.getByText(label, { selector: "label" }).parentElement as HTMLElement;
  const 눌린카드 = (root: HTMLElement = document.body) =>
    Array.from(root.querySelectorAll('button[aria-pressed="true"]')).map((b) => b.textContent);

  it("처음 열면 예/아니오/모름 어느 카드도 눌려 있지 않다", async () => {
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getAllByRole("button", { name: "모름" }).length).toBeGreaterThan(0);
    expect(눌린카드()).toEqual([]);
  });

  it("숫자 질문의 '모름' 도 고르기 전에는 눌려 있지 않다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getAllByRole("button", { name: "모름" }).length).toBeGreaterThan(0);
    expect(눌린카드()).toEqual([]);
  });

  it("'모름' 을 직접 고르면 그 질문의 '모름' 만 눌린다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(within(질문칸("부모와 별도로 거주하나요?")).getByRole("button", { name: "모름" }));
    await user.click(screen.getByRole("button", { name: "부모와 따로 거주 고치기: 모름" }));

    expect(눌린카드(질문칸("부모와 별도로 거주하나요?"))).toEqual(["모름"]);
    expect(눌린카드()).toEqual(["모름"]);
    expect(loadProfile()?.livesApartFromParents).toBe("unknown");
  });

  it("다시 들어오면 직접 고른 답만 눌려 있다 — '모름' 으로 고른 것도 남는다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    const first = render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(within(질문칸("부모와 별도로 거주하나요?")).getByRole("button", { name: "아니다" }));
    await user.click(within(질문칸("해당 주소로 전입신고가 가능한가요?")).getByRole("button", { name: "모름" }));
    first.unmount();

    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(눌린카드(질문칸("부모와 별도로 거주하나요?"))).toEqual(["아니다"]);
    expect(눌린카드(질문칸("해당 주소로 전입신고가 가능한가요?"))).toEqual(["모름"]);
    expect(눌린카드()).toEqual(["아니다", "모름"]);
  });

  it("답한 질문 기록이 없는 옛 프로필은 모름이 아닌 값만 고른 것으로 본다", async () => {
    saveAnswers(일층);
    saveProfile({
      ...makeProfile(),
      livesApartFromParents: false,
      canRegisterResidence: "unknown",
      hasNoHouse: "unknown",
      isContractHolder: "unknown",
    });
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(눌린카드(질문칸("부모와 별도로 거주하나요?"))).toEqual(["아니다"]);
    expect(눌린카드(질문칸("해당 주소로 전입신고가 가능한가요?"))).toEqual([]);
  });

  it("손대지 않은 질문은 판정에 여전히 '모름' 으로 저장된다", async () => {
    const user = userEvent.setup();
    saveAnswers(일층);
    render(<EligibilityPage />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(within(질문칸("부모와 별도로 거주하나요?")).getByRole("button", { name: "그렇다" }));
    expect(loadProfile()?.canRegisterResidence).toBe("unknown");
  });
});

/*
 * 1층 '현재 상태'(대학생 · 재직 · 구직)를 2층 '현재 상태 (재학 · 재직 등)' 질문에 이어받는 테스트는
 * 2026-11-15 에 뺐다. 그 질문을 쓰던 정책이 전남 강진군 하나뿐이었는데, 목표 지역을 익산시로
 * 정리하면서 강진군 정책이 빠졌다 — 지금 데이터로는 그 질문이 화면에 나오지 않는다.
 * 이어받는 코드(app/eligibility/page.tsx 의 asksStatus)는 그대로 두었다. 그 질문을 쓰는 정책이
 * 다시 생기면 git 기록(2026-11-14 판)의 테스트를 되살린다.
 */
