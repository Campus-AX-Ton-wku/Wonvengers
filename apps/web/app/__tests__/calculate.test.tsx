// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalculatePage from "@/app/calculate/page";
import { loadListing, saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => {
  // 렌더마다 새 객체를 주면 router 를 의존성으로 쓰는 useEffect 가 무한히 다시 돈다.
  // 실제 next/navigation 의 useRouter 는 컨텍스트에서 같은 객체를 준다.
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});

/**
 * QA체크리스트 "2층 — 정밀 계산" 절의 예시 매물·금액 입력 항목을 자동화한 것.
 *
 * 여기 있는 규칙들은 정직성에 직접 걸린다 — 예시를 불러왔다고 "내가 확인했다"는
 * 체크박스를 앱이 대신 켜주면 앱이 거짓을 말한다.
 * lib/examples.ts 테스트가 함수 수준을 지키고, 이 파일이 화면이 그 함수를 쓰는지 지킨다.
 */

const 확인체크박스 = () => screen.getByRole("checkbox") as HTMLInputElement;

describe("/calculate 입력 검증", () => {
  it("지역을 고르지 않으면 다음으로 넘어가지 않고 이유를 말한다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("거주 예정 지역을 선택해주세요.")).toBeTruthy();
  });

  it("만원 단위로 입력받는다 — 3 을 넣으면 3만원이다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.type(screen.getAllByRole("spinbutton")[0], "3"); // 보증금
    expect(screen.getByText("3만원")).toBeTruthy();

    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 익산시");
    await user.click(screen.getByRole("button", { name: "월세" }));
    await user.type(screen.getAllByRole("spinbutton")[1], "35"); // 월세
    await user.click(screen.getByRole("button", { name: "다음" }));

    // 저장·계산은 그대로 원 단위여야 한다
    expect(loadListing()?.deposit).toBe(30_000);
    expect(loadListing()?.rentOrYearlyAmount).toBe(350_000);
  });

  it("음수는 입력되는 순간 0으로 막힌다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    const 보증금 = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    await user.clear(보증금);
    await user.type(보증금, "-5000");
    expect(Number(보증금.value)).toBeGreaterThanOrEqual(0);
  });
});

/**
 * 1층에서 이미 고른 지역을 2층에서 또 묻지 않는다. 같은 질문을 두 번 하면
 * 1층과 2층이 별개의 앱처럼 느껴진다.
 */
describe("/calculate 1층 답변 이어받기", () => {
  it("1층에서 고른 지역으로 채우고, 채웠다는 사실을 알려준다", () => {
    saveAnswers({
      birthDate: birthDateForAge(23),
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
      housingType: null,
    });
    render(<CalculatePage />);

    const region = screen.getByRole("combobox") as HTMLSelectElement;
    expect(region.value).toBe("전북특별자치도 익산시");
    expect(screen.getByText(/앞에서 고른 지역으로 채웠어요/)).toBeTruthy();
  });

  it("사용자가 지역을 직접 바꾸면 안내 문구를 거둔다", async () => {
    const user = userEvent.setup();
    saveAnswers({
      birthDate: birthDateForAge(23),
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
      housingType: null,
    });
    render(<CalculatePage />);

    await user.selectOptions(screen.getByRole("combobox"), "서울특별시 종로구");
    expect(screen.queryByText(/앞에서 고른 지역으로 채웠어요/)).toBeNull();
  });

  it("1층을 건너뛴 사람에게는 지역이 비어 있다", () => {
    render(<CalculatePage />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/앞에서 고른 지역으로 채웠어요/)).toBeNull();
  });
});

/*
 * 계약 시작 예정일은 휠 데이트 피커다 (⚠️ 스파이크).
 *
 * jsdom 은 레이아웃이 없어 실제 스크롤을 흉내낼 수 없다 — scrollTop 이 항상 0이다.
 * 그래서 여기서는 굴러가는 감각이 아니라 **값이 새는 경로**를 지킨다: 확인을 누르기
 * 전에는 저장되지 않는지, 없는 날짜가 남지 않는지, 연도 방향이 뒤바뀌지 않았는지.
 * 스크롤 위치 ↔ 인덱스 계산은 lib/__tests__/wheel.test.ts 가 따로 덮는다.
 */
describe("/calculate 계약 시작 예정일 (휠 피커)", () => {
  const 열기 = () => screen.getByRole("button", { name: /^계약 시작 예정일 —/ });
  const 칸 = (part: string) => screen.getByRole("listbox", { name: `계약 시작 예정일 ${part}` });
  const 항목 = (part: string, name: string | RegExp) =>
    within(칸(part)).getByRole("option", { name });

  /** 1스텝(방 조건)을 직접 채워 넘긴다. 예시로 채우는 버튼은 없앴다. */
  async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
    render(<CalculatePage />);
    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 익산시");
    await user.click(screen.getByRole("button", { name: "월세" }));
    await user.type(screen.getAllByRole("spinbutton")[1], "35"); // 월세 — 0 이면 넘어가지 않는다
    await user.click(screen.getByRole("button", { name: "다음" }));
  }

  it("짧은 페이지 제목은 강제로 줄을 나누지 않는다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "비용과 기간을 알려주세요"
    );
  });

  it("연도 목록이 작년부터 오름차순이다 (생년월일과 반대 방향)", async () => {
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(열기());

    const years = within(칸("년")).getAllByRole("option").map((o) => o.textContent);
    const now = new Date().getFullYear();
    expect(years[0]).toBe(`${now - 1}년`);
    expect(years.at(-1)).toBe(`${now + 2}년`);
  });

  // 휠은 항상 무언가를 가리킨다. 확인 전에 값이 새면 손대지 않은 사람이 오늘 날짜를 제출한다.
  it("'확인' 을 누르기 전에는 값이 저장되지 않는다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);

    await user.click(열기());
    await user.click(항목("년", "2027년"));
    await user.click(항목("월", "9월"));
    await user.click(항목("일", "1일"));

    // 아직 확인을 안 눌렀다 — 필수값 검증이 막아야 한다
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("계약 시작 예정일을 입력해주세요.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "확인" }));
    // 저장은 검증을 다 통과해야 일어난다 — '실제 계약과 일치' 확인까지 켠다
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.queryByText("계약 시작 예정일을 입력해주세요.")).toBeNull();
    expect(loadListing()?.contractStartDate).toBe("2027-09-01");
  });

  it("고른 날짜를 트리거 버튼에 그대로 보여준다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);

    expect(screen.getByRole("button", { name: "계약 시작 예정일 — 선택 안 함" })).toBeTruthy();

    await user.click(열기());
    await user.click(항목("년", "2027년"));
    await user.click(항목("월", "3월"));
    await user.click(항목("일", "5일"));
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.getByRole("button", { name: "계약 시작 예정일 — 2027년 3월 5일" })).toBeTruthy();
  });

  /* 키보드 타이핑 점프. 스크롤은 jsdom 에서 흉내낼 수 없지만 keydown 은 실제로 뜬다.
     연도 목록이 4개뿐인 계약 예정일에서도 되는지, 그리고 버퍼가 이어 붙는지 본다. */
  it("숫자를 치면 그 항목으로 뛴다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(열기());

    칸("월").focus();
    await user.keyboard("9");
    expect(항목("월", "9월").getAttribute("aria-selected")).toBe("true");

    // 이어 치면 좁혀진다 — 1 다음 2 는 12월
    await user.keyboard("12");
    expect(항목("월", "12월").getAttribute("aria-selected")).toBe("true");
  });

  it("화살표로도 옮길 수 있다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(열기());

    칸("월").focus();
    await user.keyboard("5");
    await user.keyboard("{ArrowDown}");
    expect(항목("월", "6월").getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Home}");
    expect(항목("월", "1월").getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{End}");
    expect(항목("월", "12월").getAttribute("aria-selected")).toBe("true");
  });

  // 3월 31일을 고른 뒤 2월로 옮기면 2월 31일이 남으면 안 된다.
  it("없는 날짜가 남지 않게 자른다", async () => {
    const user = userEvent.setup();
    await goToStep2(user);

    await user.click(열기());
    await user.click(항목("년", "2026년"));
    await user.click(항목("월", "3월"));
    await user.click(항목("일", "31일"));
    await user.click(항목("월", "2월"));

    expect(항목("일", "28일").getAttribute("aria-selected")).toBe("true");
    expect(within(칸("일")).queryByRole("option", { name: "31일" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "확인" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(loadListing()?.contractStartDate).toBe("2026-02-28");
  });
});

/**
 * F1-4. 이사비·중개보수 일시 지출은 그걸 지원하는 정책이 있는 지역에서만 묻는다.
 *
 * 전에는 모든 지역에 항상 물었다. 지원 정책이 있는 줄 모르는 사람은 기본값 0 을
 * 그대로 두고 넘어가고, 그러면 최대 50만원짜리 지원이 0원으로 계산돼 사라진다.
 */
describe("/calculate 이사비 질문", () => {
  async function 스텝2로(user: ReturnType<typeof userEvent.setup>, region: string) {
    render(<CalculatePage />);
    await user.selectOptions(screen.getByRole("combobox"), region);
    await user.click(screen.getByRole("button", { name: "월세" }));
    await user.type(screen.getAllByRole("spinbutton")[1], "35");
    await user.click(screen.getByRole("button", { name: "다음" }));
  }

  it("익산에서는 지원한다는 사실을 먼저 말하고 묻는다", async () => {
    const user = userEvent.setup();
    await 스텝2로(user, "전북특별자치도 익산시");

    expect(screen.getByLabelText(/이사비·중개보수로 얼마를/)).toBeTruthy();
    expect(screen.getByText(/최대 50만원까지 지원해요/)).toBeTruthy();
  });

  it("지원 정책이 없는 지역에는 아예 묻지 않고, 남아 있던 값도 지운다", async () => {
    const user = userEvent.setup();
    await 스텝2로(user, "전북특별자치도 익산시");

    await user.type(screen.getByLabelText(/이사비·중개보수로 얼마를/), "60");
    await user.click(screen.getByRole("button", { name: "이전 단계로" }));
    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 전주시");
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.queryByLabelText(/이사비·중개보수로 얼마를/)).toBeNull();
    expect(loadListing()?.oneTimeMoveCost).toBe(0);
  });
});
