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
const ageSelect = () => screen.getByLabelText("나이") as HTMLSelectElement;

describe("/find 나이 선택", () => {
  it("기본은 미선택이고, 목록에서 나이를 고른다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(ageSelect().value).toBe("");
    await user.selectOptions(ageSelect(), "25");
    expect(ageSelect().value).toBe("25");
  });

  it("목록이 만 18세부터 45세까지 한 살씩 이어진다", () => {
    render(<FindPage />);
    const options = Array.from(ageSelect().options).filter((o) => o.value !== "");

    expect(options).toHaveLength(28);
    expect(options[0].value).toBe("18");
    expect(options.at(-1)!.value).toBe("45");
  });

  // 전북청년 지역정착·익산 이사비가 만 18세부터 대상이다. 목록에서 빼면 대상자를 돌려보낸다.
  it("만 18세를 고를 수 있고, 범위 밖 안내가 뜨지 않는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.selectOptions(ageSelect(), "18");
    expect(ageSelect().value).toBe("18");
    expect(screen.queryByText(/이 나이로는/)).toBeNull();
  });

  it("만 18세에게도 18세부터 받는 정책 2건이 후보로 남는다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.selectOptions(ageSelect(), "18");
    expect(screen.getByText("지원금 2건 보기")).toBeTruthy();
  });

  // 40~45세를 고를 수 있게 열어 둔 이유가 이 안내다.
  it("대상 정책이 없는 나이를 고르면 안내 문구가 뜬다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    expect(screen.queryByText(/이 나이로는/)).toBeNull();
    await user.selectOptions(ageSelect(), "42");
    expect(screen.queryByText(/이 나이로는/)).not.toBeNull();
  });

  /*
   * 위 안내는 고른 **뒤에** 뜬다. 그래서 목록 안에서도 경계를 보여준다 —
   * 41세가 그 옵션이 무용하다는 걸 고르기 전에 알 수 있어야 한다.
   * (지우지 않는 이유는 lib/__tests__/age.test.ts 의 ageOptionGroups 참고.)
   */
  it("목록이 해당 지원금 있음·없음 두 그룹으로 나뉘어 있다", () => {
    render(<FindPage />);
    const groups = Array.from(ageSelect().querySelectorAll("optgroup"));

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toMatch(/있음/);
    expect(groups[1].label).toMatch(/없음/);
  });

  it("39세는 '있음' 그룹, 40세는 '없음' 그룹에 들어 있다", () => {
    render(<FindPage />);
    const 그룹라벨 = (value: string) =>
      (
        Array.from(ageSelect().options).find((o) => o.value === value)
          ?.parentElement as HTMLOptGroupElement | null
      )?.label;

    expect(그룹라벨("39")).toMatch(/있음/);
    expect(그룹라벨("40")).toMatch(/없음/);
  });

  /* '나이를 선택하세요' 는 어느 그룹에도 넣지 않는다 — 그룹 안에 들어가면
     '있음' 묶음의 첫 항목처럼 읽힌다. */
  it("미선택 항목은 그룹 밖에 있다", () => {
    render(<FindPage />);
    const 미선택 = Array.from(ageSelect().options).find((o) => o.value === "");

    expect(미선택?.parentElement?.tagName).toBe("SELECT");
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

    // 대상 정책이 없는 나이를 고르면 후보가 0건이 된다
    await user.selectOptions(ageSelect(), "45");
    expect(screen.getByText("왜 해당되지 않는지 보기")).toBeTruthy();
    expect(screen.getByText(/지금 답변으로는 해당되는 지원금이 없습니다/)).toBeTruthy();
  });

  // 접수가 끝난 정책도 후보에 들어가므로, 건수만 크게 말하면 "지금 3건 신청 가능"
  // 으로 읽힌다. 마감 건수가 있으면 그걸 먼저 말한다.
  it("접수 마감된 정책이 있으면 CTA 보조 문구가 신청 가능·마감 건수를 나눈다", async () => {
    const user = userEvent.setup();
    render(<FindPage />);

    await user.selectOptions(ageSelect(), "23");
    await user.click(screen.getByRole("button", { name: "전북특별자치도 익산시" }));
    await user.click(screen.getByRole("button", { name: "대학생" }));
    await user.click(screen.getByRole("button", { name: "월 100만원 이하" }));

    expect(screen.getByText("지원금 3건 보기")).toBeTruthy();
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    expect(screen.getByText(/지금 신청 가능 \d+건 · 접수 마감 \d+건/)).toBeTruthy();
  });
});

describe("/find 답변 보관", () => {
  it("저장된 답변을 불러와 화면에 되살린다", () => {
    saveAnswers({ age: 27, region: "전북특별자치도 익산시", status: "재직", incomeBracket: 2 });
    render(<FindPage />);

    expect(ageSelect().value).toBe("27");
    expect(screen.getByRole("button", { name: "재직" }).getAttribute("class")).toContain("brand-600");
  });

  it("이 화면에는 지원금 카드가 없다 (목록은 /find/policies)", () => {
    render(<FindPage />);
    expect(screen.queryByText(/해당되지 않는 지원금/)).toBeNull();
    expect(screen.queryByText("공식 페이지 →")).toBeNull();
  });
});
