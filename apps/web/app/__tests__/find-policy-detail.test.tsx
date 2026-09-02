// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PolicyDetail from "@/app/find/policies/[id]/PolicyDetail";
import policiesJson from "@/data/policies.json";
import { saveAnswers } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

/**
 * 정책 상세.
 *
 * 목록 카드에서 내려간 것들(공고 문구·요건·신청 기간·출처·신청 링크)이 전부
 * 여기 있는지 확인한다. 카드에서 지우기만 하고 여기 없으면 정보가 사라진 것이다.
 */

const policies = policiesJson as PolicyMeta[];

const 익산_대학생 = {
  birthDate: birthDateForAge(23),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

async function render상세(id: string) {
  render(<PolicyDetail id={id} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("/find/policies/[id]", () => {
  it("이름·기관·공고 상한·공고 문구를 보여준다", async () => {
    saveAnswers(익산_대학생);
    await render상세("iksan-newcomer-moving-cost-support");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "익산시 전입 청년 이사비·중개보수 지원사업"
    );
    expect(screen.getByText("익산시")).toBeTruthy();
    expect(screen.getByText("최대 50만원")).toBeTruthy();
    expect(screen.getByText(/생애 1회 지원/)).toBeTruthy();
  });

  it("지원 대상과 신청 기간을 표로 밝힌다", async () => {
    saveAnswers(익산_대학생);
    await render상세("iksan-newcomer-moving-cost-support");

    expect(screen.getByText("만 18~39세")).toBeTruthy();
    // 상시 접수 사업 — 마감일이 null 이면 '상시' 라고 적는다
    expect(screen.getByText("2025.10.13 ~ 상시")).toBeTruthy();
  });

  it("접수가 끝난 정책은 언제 끝났는지와 다음에 할 일을 말한다", async () => {
    saveAnswers(익산_대학생);
    await render상세("moland-youth-rent-support");

    expect(screen.getByText("접수 마감")).toBeTruthy();
    expect(screen.getByText(/2026.05.29에 접수가 끝났습니다/)).toBeTruthy();
  });

  it("대상이 아니면 왜 아닌지 말한다", async () => {
    saveAnswers(익산_대학생); // 대학생이라 재직자만 받는 전북 정착 사업의 대상이 아니다
    await render상세("jeonbuk-youth-settlement-support");

    expect(screen.getByText("대상이 아닌 이유")).toBeTruthy();
    expect(screen.getByText(/재직만 신청할 수 있습니다/)).toBeTruthy();
  });

  /* 1층 질문으로 판정할 수 없는 항목은 지어내지 않는다 (PRD F0-5). */
  it("소득으로 판정하지 않는 정책은 그렇다고 적는다", async () => {
    saveAnswers(익산_대학생);
    await render상세("youth-housing-benefit-split-payment");

    expect(screen.getByText(/1층 질문\(본인 월 소득\)으로는 판정하지 않습니다/)).toBeTruthy();
  });

  it("출처와 내부 신청 준비 화면으로 가는 길이 있다", async () => {
    saveAnswers(익산_대학생);
    const policy = policies.find((p) => p.id === "iksan-newcomer-moving-cost-support")!;
    await render상세(policy.id);

    expect(screen.getByRole("link", { name: "공고 원문 →" }).getAttribute("href")).toBe(
      policy.sourceUrl
    );
    expect(screen.getByRole("link", { name: "신청 준비하기" }).getAttribute("href")).toBe(
      `/find/policies/${policy.id}/prepare`
    );
  });

  it("모든 정책에 상세 화면이 있다 — 카드가 가리키는 곳이 비어 있으면 안 된다", async () => {
    saveAnswers(익산_대학생);
    for (const policy of policies) {
      const { unmount } = render(<PolicyDetail id={policy.id} />);
      expect(await screen.findByRole("heading", { level: 1 }), policy.id).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(policy.name);
      unmount();
    }
  });

  it("없는 id 로 들어오면 목록으로 돌아갈 길을 준다", () => {
    render(<PolicyDetail id="없는-정책" />);

    expect(screen.getByText("찾을 수 없는 지원금입니다.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "목록으로 돌아가기" }).getAttribute("href")).toBe(
      "/find/policies"
    );
  });
});
