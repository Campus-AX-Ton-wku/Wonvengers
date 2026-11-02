// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BenefitResultCard from "@/app/result/BenefitResultCard";
import { ResultLoading, ResultState } from "@/app/result/ResultState";
import { toBenefitResultCardData } from "@/lib/benefit-result";
import type { PolicyResult } from "@/lib/types";

function result(status: PolicyResult["status"] = "예상적용"): PolicyResult {
  return {
    policy: {
      id: "real-policy-id",
      discovery: { ageMin: 19, ageMax: 39, regions: ["전국"], statuses: null, incomeBracketMin: null, incomeBracketMax: null, housingTypes: null },
      name: "실제 응답 정책명",
      agency: "실제 응답 기관",
      regionScope: "전국",
      applicationStart: "2026-01-01",
      applicationEnd: "2026-09-09",
      benefitType: "lump_sum",
      benefitSummary: "실제 데이터",
      lumpSumCap: 500000,
      lumpSumBasis: "oneTimeMoveCost",
      requiredInputs: [],
      exclusiveGroup: [],
      sourceUrl: "https://example.com/source",
      applyUrl: "https://example.com/apply",
      youthPolicyNo: null,
      gov24ServiceId: null,
      verifiedAt: "2026-08-30",
      effectiveYear: 2026,
      notes: "실제 검수 메모",
    },
    status,
    checks: [],
    passedLabels: ["나이", "거주지"],
    failedLabels: [],
    unknownLabels: status === "조건충족시가능" ? ["소득"] : [],
    estimatedAmount: 500000,
  };
}

describe("공식 Benefit Result Card", () => {
  it("urgent의 실제 마감일과 D-day, 앱 상세 CTA를 표시한다", () => {
    const policyResult = result();
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} />);

    expect(screen.getByText("마감 임박").className).toContain("danger");
    expect(screen.getByText("D-7")).toBeTruthy();
    expect(screen.getByText("9월 9일 마감")).toBeTruthy();
    expect(screen.getByRole("link", { name: /공식 신청 페이지에서 진행/ }).getAttribute("href")).toBe(
      "/find/policies/real-policy-id/prepare"
    );
    expect(screen.getByRole("link", { name: "마감 전 신청 준비하기" }).getAttribute("href")).toBe("/find/policies/real-policy-id");
  });

  it("check CTA는 해당 정책의 확인 필요 조건만 보는 화면으로 이동하고 외부 링크는 새 창에서 연다", () => {
    const policyResult = result("조건충족시가능");
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} />);

    expect(screen.getByRole("link", { name: "조건 1개 확인하기" }).getAttribute("href")).toBe(
      "/result/review/real-policy-id",
    );
    expect(screen.getByRole("link", { name: /확인 필요 1개/ }).getAttribute("href")).toBe(
      "/result/review/real-policy-id",
    );
    const source = screen.getByRole("link", { name: /실제 응답 기관 공식 출처/ });
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.className).toContain("min-h-11");
  });

  it("세 단계와 CTA의 터치 영역이 44px 이상이다", () => {
    const policyResult = result();
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} />);
    const article = screen.getByRole("article");
    expect(article.querySelectorAll(":scope > ol > li")).toHaveLength(3);
    expect(within(article).getByRole("link", { name: "마감 전 신청 준비하기" }).className).toMatch(/min-h-(?:11|\[50px\])/);
  });
});

describe("결과 예외 상태", () => {
  it.each([
    ["empty", "조건에 맞는 혜택을 찾지 못했어요", "내 정보 수정하기"],
    ["error", "혜택을 불러오지 못했어요", "다시 시도하기"],
    ["expired", "이번 모집은 종료됐어요", "신청 가능한 혜택 보기"],
  ] as const)("%s 상태가 이유와 다음 행동을 제공한다", (kind, title, action) => {
    render(<ResultState kind={kind} />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByRole(kind === "error" ? "button" : "link", { name: action })).toBeTruthy();
  });

  it("loading 상태를 스크린리더에 알리고 skeleton은 숨긴다", () => {
    render(<ResultLoading />);
    expect(screen.getByRole("status").textContent).toBe("혜택 계산 중");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });
});
