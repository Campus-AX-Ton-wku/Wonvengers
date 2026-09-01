// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FindPage from "@/app/find/page";
import { loadAnswers, saveAnswers, saveAnsweredKeys } from "@/lib/storage";

/**
 * QA체크리스트 "1층 — 질문" 절을 자동화한 것. lib 테스트는 판정 규칙을 지키지만,
 * 화면이 그 규칙을 실제로 불러 쓰는지는 잡지 못한다.
 *
 * 1층은 한 화면에 한 질문씩 묻고, 답한 질문은 아래로 쌓인다. 진행바가 없는 이유와
 * 쌓기로 결정한 이유는 app/Stepper.tsx 주석에 있다.
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, replace: vi.fn() }) }));

beforeEach(() => {
  pushMock.mockClear();
  window.localStorage.clear();
});

const 제목 = () => screen.getByRole("heading", { level: 1 }).textContent ?? "";
const cta = () => screen.getByRole("button", { name: /다음|보기$/ });
const 뒤로 = () => screen.getByLabelText("이전 단계로");

/** 생년월일 휠 — 트리거를 열고 세 칸을 고른 뒤 '확인'. 2층과 같은 컴포넌트다. */
async function 생년월일고르기(
  user: ReturnType<typeof userEvent.setup>,
  year: number,
  month: number,
  day: number
) {
  // 아직 안 고른 사람에게는 패널이 펼쳐진 채로 뜬다(defaultOpen). 트리거는 토글이라
  // 그 상태에서 누르면 오히려 닫힌다 — 닫혀 있을 때만 누른다.
  if (screen.queryByRole("listbox", { name: "생년월일 년" }) === null) {
    await user.click(screen.getByRole("button", { name: /^생년월일 —/ }));
  }
  for (const [칸, 값] of [
    ["년", `${year}년`],
    ["월", `${month}월`],
    ["일", `${day}일`],
  ] as const) {
    await user.click(
      within(screen.getByRole("listbox", { name: `생년월일 ${칸}` })).getByRole("option", {
        name: 값,
      })
    );
  }
  await user.click(screen.getByRole("button", { name: "확인" }));
}

/** 1월 1일생이면 올해 생일이 지났으므로 만 나이가 연도 차이와 같다. */
const 생년 = (나이: number) => new Date().getFullYear() - 나이;

/** 다섯 질문에 모두 답하고 마지막 단계에 서 있는 상태로 만든다. */
async function 다섯질문답하기(user: ReturnType<typeof userEvent.setup>, 나이 = 23) {
  await 생년월일고르기(user, 생년(나이), 1, 1);
  await user.click(cta());
  await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));
  await user.click(cta());
  await user.click(screen.getByRole("button", { name: "대학생" }));
  await user.click(cta());
  await user.click(screen.getByRole("button", { name: "월 100만원 이하" }));
  await user.click(cta());
  await user.click(screen.getByRole("button", { name: "월세" }));
}

describe("/find 단계형 흐름", () => {
  it("첫 화면은 생년월일 질문 하나뿐이다 — 네 질문을 한꺼번에 쌓지 않는다", () => {
    render(<FindPage />);

    expect(제목()).toBe("생년월일이 어떻게 되시나요?");
    expect(screen.queryByRole("button", { name: "전북특별자치도 익산시" })).toBeNull();
    expect(screen.queryByRole("button", { name: "대학생" })).toBeNull();
  });

  /* 진행률은 쌓인 답이 대신한다. 1층 4 + 계약 2 + 2층 N 을 '3/11' 로 먼저 보여주면
     시작하기도 전에 질린다 (Stepper.tsx 주석). */
  it("진행바도 스텝 숫자도 없다", () => {
    render(<FindPage />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/\d\s*\/\s*\d/)).toBeNull();
  });

  it("답하면 다음 질문으로 넘어가고, 답한 질문은 아래로 쌓인다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());

    expect(제목()).toBe("어디에 살거나 살 예정인가요?");
    expect(screen.getByRole("button", { name: "생년월일 고치기" })).toBeTruthy();
    expect(screen.getByText(new RegExp(`1998년 3월 14일 · 만 ${생년(0) - 1998}세`))).toBeTruthy();
  });

  it("쌓인 답을 누르면 그 질문으로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "생년월일 고치기" }));

    expect(제목()).toBe("생년월일이 어떻게 되시나요?");
  });

  it("뒤로가기로 앞 질문에 돌아간다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());
    await user.click(뒤로());

    expect(제목()).toBe("생년월일이 어떻게 되시나요?");
  });

  /*
   * null 은 '모름'과 '아직 안 물어봄'을 겸한다. 답하기 전에 '모름'이 켜져 있으면
   * 고르지도 않은 답을 했다고 화면이 주장하는 셈이다 (lib/storage.ts 의
   * loadAnsweredKeys 주석).
   */
  it("답하기 전에는 '모름'이 선택돼 있지 않다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());

    expect(screen.getByRole("button", { name: "모름" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("'모름'을 고르면 그때 선택되고 요약에도 모름으로 쌓인다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "모름" }));
    expect(screen.getByRole("button", { name: "모름" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(cta());
    expect(within(screen.getByRole("button", { name: "사는 곳 고치기" })).getByText("모름")).toBeTruthy();
  });

  it("다시 들어오면 답이 다 쌓인 마지막 단계에서 시작한다 — 답변 고치기 진입점", () => {
    saveAnswers({
      birthDate: "1998-03-14",
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
      housingType: "월세",
    });
    saveAnsweredKeys(["birthDate", "region", "status", "incomeBracket", "housingType"]);
    render(<FindPage />);

    expect(제목()).toBe("현재 어떤 형태로 거주하고 있나요?");
    for (const label of ["생년월일 고치기", "사는 곳 고치기", "현재 상태 고치기", "월 소득 고치기"]) {
      expect(screen.getByRole("button", { name: label }), label).toBeTruthy();
    }
  });
});

describe("/find 나이 조건", () => {
  it("대상 연령 안내가 고르기 전에도 보인다", () => {
    render(<FindPage />);
    expect(screen.getByText(/만 18~39세/)).toBeTruthy();
  });

  /* 나이는 고르는 선택지가 아니라 이미 정해진 사실이다. 그 사실에 판정을 얹으면
     41세가 39세를 고른다 — 받을 수 없는 금액을 받을 수 있다고 믿게 된다. */
  it("입력에 자격 판정을 섞지 않는다 — 있음·없음으로 나뉜 목록이 없다", () => {
    const { container } = render(<FindPage />);

    expect(container.querySelector("optgroup")).toBeNull();
    expect(screen.queryByText(/해당되는 지원금 없음/)).toBeNull();
  });

  /*
   * 안내는 상수(만 18~39세)가 아니라 실제 판정 결과로 낸다.
   *
   * 전세보증금반환보증 보증료 지원이 들어오면서 '나이 제한 없음' 정책이 생겼다.
   * 상수로 판단하면 42세에게 "해당되는 지원금이 없다"고 말하는데, 그 사람은
   * 이 사업의 대상이다 — 앱이 있는 지원금을 없다고 말하게 된다.
   */
  it("나이 제한이 없는 정책이 있으면 범위 밖 나이에도 안내를 띄우지 않는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(screen.queryByText(/이 나이로는/)).toBeNull();
    await 생년월일고르기(user, 생년(42), 1, 1);
    expect(screen.queryByText(/이 나이로는/)).toBeNull();
  });

  // 전북청년 지역정착·익산 이사비가 만 18세부터 대상이다. 빼면 대상자를 돌려보낸다.
  it("만 18세를 고를 수 있다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 생년(18), 1, 1);
    expect(screen.queryByText(/이 나이로는/)).toBeNull();
  });

  /* 예전에는 목록 상한이 만 45세라 46세는 아예 답을 못 했다. 사실 값을 임의로
     자르면 그 사람에게 남는 길은 거짓으로 답하거나 앱이 고장났다고 보는 것뿐이다. */
  it("만 46세 이상도 생년월일을 답할 수 있다", () => {

    render(<FindPage />);

    const 년 = within(screen.getByRole("listbox", { name: "생년월일 년" }));
    expect(년.getByRole("option", { name: `${생년(64)}년` })).toBeTruthy();
  });
});

describe("/find CTA", () => {
  it("현재 질문에 답하기 전에는 다음으로 갈 수 없다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect((cta() as HTMLButtonElement).disabled).toBe(true);
    await user.click(cta());
    expect(제목()).toBe("생년월일이 어떻게 되시나요?");

    await 생년월일고르기(user, 생년(23), 1, 1);
    expect((cta() as HTMLButtonElement).disabled).toBe(false);
    await user.click(cta());

    expect((cta() as HTMLButtonElement).disabled).toBe(true);
    await user.click(cta());
    expect(제목()).toBe("어디에 살거나 살 예정인가요?");

    // 명시적으로 고른 '모름'은 유효한 답이다.
    await user.click(screen.getByRole("button", { name: "모름" }));
    expect((cta() as HTMLButtonElement).disabled).toBe(false);
  });

  /* 답할수록 숫자가 좁혀지는 게 보여야 계속 답할 이유가 된다. 한 화면에 네 질문을
     두던 시절의 즉시 피드백을 단계형에서도 지킨다. */
  it("답할 때마다 CTA 건수가 좁혀진다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    // 전부 모름 = 정책 6건 중 접수 중인 4건
    expect(cta().textContent).toBe("지원금 4건 · 다음");

    // 나이·지역만으로는 안 줄어든다 — 남은 정책이 전부 전국 아니면 익산이다
    await 생년월일고르기(user, 생년(23), 1, 1);
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));
    expect(cta().textContent).toBe("지원금 4건 · 다음");

    // 소득 구간에서 한 번, 주거 형태에서 한 번 더 갈린다
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "대학생" }));
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "월 100만원 이하" }));
    expect(cta().textContent).toBe("지원금 3건 · 다음");

    // 월세를 고르면 전세 전용인 보증료 지원이 빠진다
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "월세" }));
    expect(cta().textContent).toBe("지원금 2건 보기");
  });

  // 목록이 아니라 결과 요약으로 보낸다. 네 질문에 답한 보상을 먼저 주고, 목록은
  // 그 화면의 CTA 가 연다 (docs/기획/2026-08-30-화면-구조-개편-설계.md).
  it("마지막 단계에서는 결과 요약으로 보낸다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 다섯질문답하기(user);
    expect(cta().textContent).toBe("지원금 2건 보기");

    await user.click(cta());
    expect(pushMock).toHaveBeenCalledWith("/find/result");
  });

  it("대상 정책이 없으면 왜 없는지 보러 가게 한다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 다섯질문답하기(user, 45);
    expect(cta().textContent).toBe("왜 해당되지 않는지 보기");
  });

  /* 후보는 있는데 전부 마감인 경우. '왜 해당되지 않는지' 로 보내면 대상이 아니라는
     뜻으로 읽히지만, 실제로는 다음 회차를 기다리면 되는 상황이다. */
  it("후보가 전부 마감이면 그렇게 말한다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 생년(30), 1, 1);
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "전북특별자치도 (익산시 외)" }));
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "재직" }));
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "월 100~150만원" }));
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "월세" }));

    expect(cta().textContent).toBe("왜 지금은 신청할 수 없는지 보기");
  });
});

describe("/find 답변 보관", () => {
  it("고른 답은 바로 저장된다 — 새로고침해도 남는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 생년월일고르기(user, 1998, 3, 14);
    await user.click(cta());
    await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));

    expect(loadAnswers().birthDate).toBe("1998-03-14");
    expect(loadAnswers().region).toBe("전북특별자치도 익산시");
  });

  it("이 화면에는 지원금 카드가 없다 (목록은 /find/policies)", () => {
    render(<FindPage />);
    expect(screen.queryByRole("article")).toBeNull();
  });
});
