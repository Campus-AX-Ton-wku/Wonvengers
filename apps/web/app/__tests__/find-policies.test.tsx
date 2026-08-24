// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import { EMPTY_ANSWERS, saveAnswers } from "@/lib/storage";
import policiesJson from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";

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

/**
 * 출처는 지역 공고 하나로 간다.
 *
 * 예전에는 카드에 `온통청년 미등록` 배지가 붙었는데, 그건 "정부 DB 에 없다"가 아니라
 * "정책번호를 매핑하지 않았다"는 뜻이었다 — 찾아본 적이 없는데 찾지 못했다고 말했다.
 * 확인한 사실만 말하기 위해, 팀이 직접 대조한 공고 원문만 보여준다.
 */
describe("/find/policies 정책 출처", () => {
  const policies = policiesJson as PolicyMeta[];

  it("정책마다 공고 원문 링크가 있고, 실제 sourceUrl 을 가리킨다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const links = screen.getAllByRole("link", { name: "공고 원문 →" });
    expect(links).toHaveLength(policies.length);

    const shown = new Set(links.map((a) => a.getAttribute("href")));
    for (const p of policies) {
      expect(shown.has(p.sourceUrl), `${p.id}: 공고 원문 링크 없음`).toBe(true);
    }
  });

  it("검수한 정책은 대조 날짜를, 검수 전 정책은 대조하지 않았다고 밝힌다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const verified = policies.filter((p) => p.verifiedAt !== null);
    const unverified = policies.filter((p) => p.verifiedAt === null);

    for (const p of verified) {
      expect(
        screen.getAllByText(`팀이 ${p.verifiedAt}에 공고 원문과 대조했습니다.`).length
      ).toBeGreaterThan(0);
    }
    // 익산형 청년월세가 아직 검수 전이다. 조용히 넘기면 미검수 값이 확인된 값처럼 보인다.
    expect(unverified.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/아직 공고 원문과 대조하지 않았습니다/)).toHaveLength(
      unverified.length
    );
  });

  it("온통청년 대조 표시가 화면에 없다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    const { container } = render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(container.textContent).not.toMatch(/온통청년/);
  });
});
