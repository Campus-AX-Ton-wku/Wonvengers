// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FindPage from "@/app/find/page";
import { saveAnswers } from "@/lib/storage";

/**
 * QA체크리스트 "1층 — 질문" 절을 자동화한 것. lib 테스트는 판정 규칙을 지키지만,
 * 화면이 그 규칙을 실제로 불러 쓰는지는 잡지 못한다.
 */

const cta = () => screen.getByRole("link", { name: /지원금 .*건 보기|왜 해당되지 않는지 보기/ });
const ageInput = () => screen.getByLabelText("나이") as HTMLInputElement;

describe("/find 나이 스테퍼", () => {
  it("빈 칸에서 + 를 누르면 20부터 시작한다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(ageInput().value).toBe("");
    await user.click(screen.getByLabelText("나이 1살 올리기"));
    expect(ageInput().value).toBe("20");
  });

  it("한 번 더 누르면 1살씩 올라간다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.click(screen.getByLabelText("나이 1살 올리기"));
    await user.click(screen.getByLabelText("나이 1살 올리기"));
    expect(ageInput().value).toBe("21");
  });

  // 전북청년 지역정착·익산 이사비가 만 18세부터 대상이다. 20으로 막으면 대상자를 돌려보낸다.
  it("만 18세를 직접 입력할 수 있고, 범위 밖 안내가 뜨지 않는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.type(ageInput(), "18");
    expect(ageInput().value).toBe("18");
    expect(screen.queryByText(/이 나이로는/)).toBeNull();
  });

  it("만 18세에게도 18세부터 받는 정책 2건이 후보로 남는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    // 전북청년 지역정착·익산 이사비만 18세를 받는다. 나머지 3건은 19세부터다.
    await user.type(ageInput(), "18");
    expect(screen.getByText("지원금 2건 보기")).toBeTruthy();
  });

  it("대상 정책이 없는 나이면 안내 문구가 뜬다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(screen.queryByText(/이 나이로는/)).toBeNull();
    await user.type(ageInput(), "17");
    expect(screen.queryByText(/이 나이로는/)).not.toBeNull();
  });

  it("모름을 누르면 나이가 비워진다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.click(screen.getByLabelText("나이 1살 올리기"));
    expect(ageInput().value).toBe("20");

    const 모름 = screen.getAllByRole("button", { name: "모름" })[0];
    await user.click(모름);
    expect(ageInput().value).toBe("");
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

    // 전부 모름 = 정책 5건 모두 '확인 필요'
    expect(screen.getByText("지원금 5건 보기")).toBeTruthy();

    // 대상 정책이 없는 나이를 넣으면 후보가 0건이 된다
    await user.type(ageInput(), "50");
    expect(screen.getByText("왜 해당되지 않는지 보기")).toBeTruthy();
    expect(screen.getByText(/지금 답변으로는 해당되는 지원금이 없습니다/)).toBeTruthy();
  });

  it("CTA 아래 보조 문구가 가능성 있음·확인 필요 건수를 나눠 보여준다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.type(ageInput(), "23");
    await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));
    await user.click(screen.getByRole("button", { name: "대학생" }));
    await user.click(screen.getByRole("button", { name: "월 100만원 이하" }));

    // 국토부·이사비 = 가능성 있음 2건, 주거급여 = 확인 필요 1건
    expect(screen.getByText("지원금 3건 보기")).toBeTruthy();
    expect(screen.getByText("가능성 있음 2건 · 확인 필요 1건")).toBeTruthy();
  });
});

describe("/find 답변 보관", () => {
  it("저장된 답변을 불러와 화면에 되살린다", () => {
    saveAnswers({ age: 27, region: "전북특별자치도 익산시", status: "재직", incomeBracket: 2 });
    render(<FindPage />);

    expect(ageInput().value).toBe("27");
    expect(screen.getByRole("button", { name: "재직" }).getAttribute("class")).toContain("brand-600");
  });

  it("이 화면에는 지원금 카드가 없다 (목록은 /find/policies)", () => {
    render(<FindPage />);
    expect(screen.queryByText(/해당되지 않는 지원금/)).toBeNull();
    expect(screen.queryByText("공식 페이지 →")).toBeNull();
  });
});
