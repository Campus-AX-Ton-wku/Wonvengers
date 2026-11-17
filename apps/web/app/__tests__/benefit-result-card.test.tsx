// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BenefitResultCard from "@/app/result/BenefitResultCard";
import { ResultLoading, ResultState } from "@/app/result/ResultState";
import { toBenefitResultCardData } from "@/lib/benefit-result";
import type { PolicyResult } from "@/lib/types";
import { makeListing } from "@/lib/__tests__/fixtures";

const listing = makeListing();

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
      contact: null,
      nextRound: null,
    },
    status,
    checks: [],
    passedLabels: ["나이", "거주지"],
    failedLabels: [],
    unknownLabels: status === "조건충족시가능" ? ["소득"] : [],
    estimatedAmount: 500000,
  };
}

describe("결과 카드 (11/17 정리 — 같은 말 반복 · 확인 안 된 ✓ · 합계 밖 금색 없앰)", () => {
  it("마감 임박은 배지 옆 한 줄에 마감일과 D-day 를 같이 쓰고, 준비 버튼은 신청 준비 화면으로 간다", () => {
    const policyResult = result();
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} listing={listing} />);

    expect(screen.getByText("마감 임박").className).toContain("danger");
    expect(screen.getByText("9월 9일 마감 · D-7")).toBeTruthy();
    expect(screen.getByRole("link", { name: "마감 전 신청 준비하기" }).getAttribute("href")).toBe(
      "/find/policies/real-policy-id/prepare"
    );
  });

  it("자격 요건 · 지원 형태 · 신청 방식 행과 '조건 N개 일치' 같은 반복을 두지 않는다", () => {
    const policyResult = result();
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} listing={listing} />);
    const article = screen.getByRole("article");

    expect(article.querySelector("ol")).toBeNull();
    for (const text of ["자격 요건", "지원 형태", "신청 방식", "내 조건과 잘 맞아요", "검수 상태"]) {
      expect(within(article).queryByText(text), text).toBeNull();
    }
    expect(within(article).queryByText(/조건 \d+개 (일치|확인)$/)).toBeNull();
  });

  it("합계에 든 금액만 금색이다 — 정해진 공고 금액은 잉크색으로 '합계에 넣지 않았다'고 밝힌다", () => {
    const counted = result();
    const countedCard = toBenefitResultCardData(counted, "2026-09-02", new Set(["real-policy-id"]))!;
    const { unmount } = render(<BenefitResultCard card={countedCard} result={counted} listing={listing} />);
    expect(screen.getByText("받을 수 있는 예상 금액")).toBeTruthy();
    expect(screen.getByText("최대 50만원").className).toContain("text-accent-700");
    unmount();

    const fixed = result("조건충족시가능");
    fixed.estimatedAmount = 0;
    fixed.policy = { ...fixed.policy, lumpSumBasis: "fixedGrant", lumpSumCap: 100000, payoutNote: "전입 6개월 후 1회 지급" };
    const fixedCard = toBenefitResultCardData(fixed, "2026-09-02", new Set())!;
    render(<BenefitResultCard card={fixedCard} result={fixed} listing={listing} />);
    expect(screen.getByText("공고상 금액")).toBeTruthy();
    expect(screen.getByText("최대 10만원").className).not.toContain("accent");
    expect(screen.getByText(/정해진 금액이라 위 합계에는 넣지 않았어요/)).toBeTruthy();
    expect(screen.queryByText(/개인 예상액 계산 전/)).toBeNull();
  });

  it("확인 필요는 빠진 조건을 보여 주고, 버튼은 해당 정책의 확인 화면으로, 출처는 새 창으로 간다", () => {
    const policyResult = result("조건충족시가능");
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} listing={listing} />);

    expect(screen.getByText("1가지 정보가 더 필요해요")).toBeTruthy();
    expect(screen.getByRole("link", { name: "조건 1개 확인하기" }).getAttribute("href")).toBe(
      "/result/review/real-policy-id",
    );
    const source = screen.getByRole("link", { name: /실제 응답 기관 공식 출처/ });
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.className).toContain("min-h-11");
  });

  it("요건 목록과 계산식은 카드 안의 닫힌 토글 하나에 있고, 버튼 터치 영역은 44px 이상이다", () => {
    const policyResult = result();
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} listing={listing} />);
    const article = screen.getByRole("article");

    const details = article.querySelectorAll("details");
    expect(details).toHaveLength(1);
    expect((details[0] as HTMLDetailsElement).open).toBe(false);
    expect(within(details[0] as HTMLElement).getByText("요건과 계산 방법 보기")).toBeTruthy();
    expect(within(details[0] as HTMLElement).getByText("나이")).toBeTruthy();
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
