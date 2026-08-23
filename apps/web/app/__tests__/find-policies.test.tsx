// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import { EMPTY_ANSWERS, saveAnswers } from "@/lib/storage";

/** QA체크리스트 "1층 — 목록" 절을 자동화한 것. */

const 익산_대학생 = {
  age: 23,
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
};

describe("/find/policies", () => {
  it("답변을 모두 모름으로 둬도 목록이 뜬다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);

    // localStorage 를 읽기 전에는 자리만 잡는다
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("지원금 5건");
  });

  it("답변 요약 칩으로 어떤 답의 결과인지 보여준다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // '익산시' 는 정책 카드의 기관명에도 나오므로 칩 목록 안에서만 찾는다
    const chips = within(screen.getByRole("list", { name: "답변 요약" }));
    for (const chip of ["23세", "익산시", "대학생", "월 100만원 이하"]) {
      expect(chips.getByText(chip), chip).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "답변 고치기" }).getAttribute("href")).toBe("/find");
  });

  it("답하지 않은 항목은 칩에 '모름'으로 남는다", async () => {
    saveAnswers({ ...익산_대학생, status: null, incomeBracket: null });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const chips = within(screen.getByRole("list", { name: "답변 요약" }));
    expect(chips.getByText("상태 모름")).toBeTruthy();
    expect(chips.getByText("소득 모름")).toBeTruthy();
  });

  it("제목의 건수와 카드 수가 같다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 익산 23세 대학생·소득 1구간 → 가능 2 + 확인 필요 1 = 3건, 해당 없음 2건
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("지원금 3건");
    expect(screen.getByText("해당되지 않는 지원금 2건 보기")).toBeTruthy();
  });

  it("해당 없음 카드에 탈락 이유가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 전북 정착은 재직자만 대상이다
    expect(screen.getByText(/재직만 신청할 수 있습니다/)).toBeTruthy();
  });

  it("접수가 끝난 정책에 접수 종료 안내가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    expect(screen.getByText(/2026-05-29에 접수가 끝났습니다/)).toBeTruthy();
  });

  it("후보가 있으면 2층 진입 CTA 가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const cta = screen.getByRole("link", { name: /얼마를 내게 될까/ });
    expect(cta.getAttribute("href")).toBe("/calculate");
  });

  it("후보가 없으면 이유를 안내하고 2층 CTA 를 숨긴다", async () => {
    saveAnswers({ ...익산_대학생, age: 55 });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("해당되는 지원금이 없어요");
    expect(screen.queryByRole("link", { name: /얼마를 내게 될까/ })).toBeNull();
  });

  it("고지 문구는 접히지 않고 항상 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/신청 자격을 확정하는 것이 아닙니다/)).toBeTruthy();
  });
});
