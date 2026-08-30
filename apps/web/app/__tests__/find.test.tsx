// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FindPage from "@/app/find/page";
import { saveAnswers } from "@/lib/storage";

/**
 * QA체크리스트 "1층 — 질문" 절을 자동화한 것. lib 테스트는 판정 규칙을 지키지만,
 * 화면이 그 규칙을 실제로 불러 쓰는지는 잡지 못한다.
 */

const cta = () =>
  screen.getByRole("link", { name: /지원금 .*건 보기|마감된 지원금 .*건 보기|왜 해당되지 않는지 보기/ });

/**
 * 생년월일은 휠 데이트 피커다 — 트리거를 열고, 컬럼에서 고르고, '확인' 을 눌러야
 * 값이 올라간다. jsdom 에서는 스크롤을 흉내낼 수 없으므로 항목을 직접 클릭한다.
 * (2층 /eligibility 와 같은 컴포넌트라 조작 방법도 같다.)
 */
const 생일칸 = (part: string) => screen.getByRole("listbox", { name: `생년월일 ${part}` });
const 생일트리거 = () => screen.getByRole("button", { name: /^생년월일 —/ });

async function 생년월일고르기(
  user: ReturnType<typeof userEvent.setup>,
  year: number,
  month: number,
  day: number
) {
  await user.click(생일트리거());
  await user.click(within(생일칸("년")).getByRole("option", { name: `${year}년` }));
  await user.click(within(생일칸("월")).getByRole("option", { name: `${month}월` }));
  await user.click(within(생일칸("일")).getByRole("option", { name: `${day}일` }));
  await user.click(screen.getByRole("button", { name: "확인" }));
}

/**
 * 그 나이가 되는 생년. 1월 1일생으로 잡으면 올해 생일이 이미 지났으므로 만 나이가
 * 연도 차이와 정확히 같아진다 — 테스트가 오늘 날짜에 흔들리지 않는다.
 */
const 생년 = (나이: number) => new Date().getFullYear() - 나이;

/** 만 <나이>세가 되도록 생년월일을 고른다. */
const 나이로고르기 = (user: ReturnType<typeof userEvent.setup>, 나이: number) =>
  생년월일고르기(user, 생년(나이), 1, 1);

describe("/find 생년월일", () => {
  /*
   * 대상 연령은 입력 옵션이 아니라 필드 밖 안내문으로 알린다.
   *
   * 전에는 <optgroup> 라벨이 "해당되는 지원금 없음 (만 40세 이상)" 이었다. 나이는
   * 고르는 선택지가 아니라 이미 정해진 사실인데, 그 사실에 판정을 붙여 놓으니
   * "없다고 써 놓고 왜 고르게 하느냐"가 됐다. 게다가 입력란에 판정을 섞으면
   * 41세가 39세를 고르게 된다 — 받을 수 없는 금액을 받을 수 있다고 믿게 된다.
   */
  it("대상 연령 안내가 고르기 전에도 보인다", () => {
    render(<FindPage />);
    expect(screen.getByText(/만 18~39세/)).toBeTruthy();
  });

  it("입력에 자격 판정을 섞지 않는다 — 있음·없음으로 나뉜 목록이 없다", () => {
    const { container } = render(<FindPage />);

    expect(container.querySelector("optgroup")).toBeNull();
    expect(screen.queryByText(/해당되는 지원금 없음/)).toBeNull();
  });

  it("기본은 미선택이고, 생년월일을 고르면 만 나이를 보여준다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(screen.getByRole("button", { name: "생년월일 — 선택 안 함" })).toBeTruthy();

    await 생년월일고르기(user, 1998, 3, 14);

    expect(screen.getByRole("button", { name: "생년월일 — 1998년 3월 14일" })).toBeTruthy();
    expect(screen.getByText(new RegExp(`만 ${생년(0) - 1998}세`))).toBeTruthy();
  });

  // 전북청년 지역정착·익산 이사비가 만 18세부터 대상이다. 목록에서 빼면 대상자를 돌려보낸다.
  it("만 18세를 고를 수 있고, 범위 밖 안내가 뜨지 않는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 나이로고르기(user, 18);

    expect(screen.queryByText(/이 나이로는/)).toBeNull();
  });

  // 후보는 2건이지만 전북 정착은 2026-04-10 에 접수가 끝났다. CTA 숫자는 지금
  // 신청할 수 있는 것만 센다 — 마감 건은 보조 문구가 따로 말한다.
  it("만 18세에게도 18세부터 받는 정책이 후보로 남는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 나이로고르기(user, 18);

    expect(screen.getByText("지원금 1건 보기")).toBeTruthy();
    expect(screen.getByText(/접수 마감 1건/)).toBeTruthy();
  });

  it("대상 정책이 없는 나이를 고르면 안내 문구가 뜬다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(screen.queryByText(/이 나이로는/)).toBeNull();
    await 나이로고르기(user, 42);
    expect(screen.queryByText(/이 나이로는/)).not.toBeNull();
  });

  /*
   * 전에는 목록 상한이 만 45세라 46세는 아예 답을 못 했다. 사실 값을 임의로
   * 자르면 그 사람에게 남는 길은 거짓으로 답하거나 앱이 고장났다고 보는 것뿐이다.
   */
  it("만 46세 이상도 생년월일을 답할 수 있다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.click(생일트리거());

    expect(within(생일칸("년")).getByRole("option", { name: `${생년(64)}년` })).toBeTruthy();
  });
});

describe("/find 목록으로 넘어가는 CTA", () => {
  it("아무것도 답하지 않아도 눌러서 목록으로 갈 수 있다", () => {
    render(<FindPage />);
    expect(cta().getAttribute("href")).toBe("/find/policies");
  });

  it("답변을 바꾸면 건수가 바로 바뀐다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    // 전부 모름 = 정책 5건 모두 '확인 필요'. 그중 2건은 접수가 끝나 CTA 는 3건.
    expect(screen.getByText("지원금 3건 보기")).toBeTruthy();

    // 대상 정책이 없는 나이를 고르면 후보가 0건이 된다
    await 나이로고르기(user, 45);
    expect(screen.getByText("왜 해당되지 않는지 보기")).toBeTruthy();
    expect(screen.getByText(/지금 답변으로는 해당되는 지원금이 없습니다/)).toBeTruthy();
  });

  // 접수가 끝난 정책도 후보에 들어가므로, 건수만 크게 말하면 "지금 3건 신청 가능"
  // 으로 읽힌다. 마감 건수가 있으면 그걸 먼저 말한다.
  it("접수 마감된 정책이 있으면 CTA 보조 문구가 신청 가능·마감 건수를 나눈다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 나이로고르기(user, 23);
    await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));
    await user.click(screen.getByRole("button", { name: "대학생" }));
    await user.click(screen.getByRole("button", { name: "월 100만원 이하" }));

    expect(screen.getByText("지원금 2건 보기")).toBeTruthy();
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다 — 숫자에 섞지 않고 따로 말한다
    expect(screen.getByText(/접수 마감 1건도 함께 볼 수 있어요/)).toBeTruthy();
  });

  /*
   * 후보는 있는데 전부 마감인 경우. "왜 해당되지 않는지 보기" 로 보내면 안 된다 —
   * 대상이 아니라는 뜻인데 실제로는 다음 회차를 기다리면 되는 상황이다.
   */
  it("후보가 전부 마감이면 그렇게 말하고 목록으로는 계속 보낸다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await 나이로고르기(user, 30);
    await user.click(screen.getByRole("button", { name: "전북특별자치도 (익산시 외)" }));
    await user.click(screen.getByRole("button", { name: "재직" }));

    expect(screen.getByText("마감된 지원금 2건 보기")).toBeTruthy();
    expect(screen.getByText(/지금 신청할 수 있는 지원금이 없습니다/)).toBeTruthy();
    expect(cta().getAttribute("href")).toBe("/find/policies");
  });
});

describe("/find 답변 보관", () => {
  it("저장된 답변을 불러와 화면에 되살린다", () => {
    saveAnswers({
      birthDate: "1998-03-14",
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
    });
    render(<FindPage />);

    expect(screen.getByRole("button", { name: "생년월일 — 1998년 3월 14일" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "재직" }).getAttribute("class")).toContain("brand-600");
  });

  it("이 화면에는 지원금 카드가 없다 (목록은 /find/policies)", () => {
    render(<FindPage />);
    expect(screen.queryByText(/해당되지 않는 지원금/)).toBeNull();
    expect(screen.queryByText("공식 페이지 →")).toBeNull();
  });
});
