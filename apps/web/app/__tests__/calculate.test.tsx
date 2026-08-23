// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalculatePage from "@/app/calculate/page";
import { loadListing, saveAnswers } from "@/lib/storage";

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
 * 체크박스를 켜주거나, 가상 조건의 출처를 "중개사 안내"로 적으면 앱이 거짓을 말한다.
 * lib/examples.ts 테스트가 함수 수준을 지키고, 이 파일이 화면이 그 함수를 쓰는지 지킨다.
 */

const 확인체크박스 = () => screen.getByRole("checkbox") as HTMLInputElement;

describe("/calculate 예시 매물", () => {
  it("예시 버튼을 누르면 입력이 채워진다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));

    expect(screen.getByDisplayValue("3000000")).toBeTruthy(); // 보증금
    expect(screen.getByDisplayValue("350000")).toBeTruthy(); // 월세
  });

  it("가상 예시라는 배지와 설명을 보여준다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    expect(screen.getByText("가상 예시 · 실제 매물이 아닙니다")).toBeTruthy();
    expect(screen.getByText(/발표 시연을 위해 만든 가상 조건/)).toBeTruthy();
  });

  it("금액을 만 단위로 바로 읽어준다 (0 하나 더 넣은 실수를 그 자리에서 잡는다)", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    expect(screen.getByText("300만원")).toBeTruthy(); // 보증금 3,000,000
    expect(screen.getByText("35만원")).toBeTruthy(); // 월세 350,000
  });

  it("예시를 불러와도 '실제 계약과 일치' 확인은 켜지지 않는다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    // 2번째 스텝으로 넘어가야 체크박스가 보인다
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(확인체크박스().checked).toBe(false);
  });

  it("미확인 예시일 때는 체크박스 문구가 '예시임을 알고'로 바뀐다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText(/실제 계약이 아닌 예시임을 알고/)).toBeTruthy();
    expect(screen.queryByText(/실제 계약 조건과 일치합니다/)).toBeNull();
  });

  it("입력 출처를 '예시 데이터'로 바꿔 저장한다 — 중개사 안내라고 우기지 않는다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    await user.click(screen.getByRole("button", { name: "다음" }));

    const saved = loadListing();
    expect(saved?.sourceType).toBe("예시 데이터");
    expect(saved?.exampleId).toBe("iksan-oneroom-monthly");
  });

  it("예시 지우기를 누르면 입력이 초기화된다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "익산 원룸 · 월세" }));
    expect(screen.getByText("가상 예시 · 실제 매물이 아닙니다")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "예시 지우고 직접 입력하기" }));
    expect(screen.queryByText("가상 예시 · 실제 매물이 아닙니다")).toBeNull();
    expect(screen.queryByDisplayValue("350000")).toBeNull();
  });
});

describe("/calculate 입력 검증", () => {
  it("지역을 고르지 않으면 다음으로 넘어가지 않고 이유를 말한다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("거주 예정 지역을 선택해주세요.")).toBeTruthy();
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
      age: 23,
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
    });
    render(<CalculatePage />);

    const region = screen.getByRole("combobox") as HTMLSelectElement;
    expect(region.value).toBe("전북특별자치도 익산시");
    expect(screen.getByText(/앞에서 고른 지역으로 채웠어요/)).toBeTruthy();
  });

  it("사용자가 지역을 직접 바꾸면 안내 문구를 거둔다", async () => {
    const user = userEvent.setup();
    saveAnswers({ age: 23, region: "전북특별자치도 익산시", status: "재직", incomeBracket: 2 });
    render(<CalculatePage />);

    await user.selectOptions(screen.getByRole("combobox"), "그 외 지역");
    expect(screen.queryByText(/앞에서 고른 지역으로 채웠어요/)).toBeNull();
  });

  it("1층을 건너뛴 사람에게는 지역이 비어 있다", () => {
    render(<CalculatePage />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/앞에서 고른 지역으로 채웠어요/)).toBeNull();
  });
});
