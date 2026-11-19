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
      icon: "moving",
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
    // 제목 왼쪽에 정책 종류 그림 — 금액 상자에는 붙이지 않는다
    const pictures = [...document.querySelectorAll("img[data-icon3d]")];
    expect(pictures.map((img) => img.getAttribute("data-icon3d"))).toEqual([policyResult.policy.icon]);
    expect(pictures[0].closest("div")!.textContent).toContain(card.title);
    expect(screen.getByText("9월 9일 마감 · D-7")).toBeTruthy();
    expect(screen.getByRole("link", { name: "마감 전 신청 준비하기" }).getAttribute("href")).toBe(
      "/find/policies/real-policy-id/prepare"
    );
  });

  it("합계 안 카드가 신청 가능이면 배지를 숨기고, 확인 필요 · 마감 임박은 배지를 둔다 — 스크린리더용 상태 문구는 남는다 (11/20)", () => {
    const eligible = result();
    const eligibleCard = toBenefitResultCardData(eligible, "2026-07-01")!;
    expect(eligibleCard.state).toBe("eligible");
    const first = render(<BenefitResultCard card={eligibleCard} result={eligible} listing={listing} />);
    expect(screen.queryByText("신청 가능")).toBeNull();
    expect(first.container.querySelector(".sr-only")?.textContent).toBe("예상적용");
    first.unmount();

    const check = result("조건충족시가능");
    const checkCard = toBenefitResultCardData(check, "2026-07-01")!;
    expect(checkCard.state).toBe("check");
    const second = render(<BenefitResultCard card={checkCard} result={check} listing={listing} />);
    expect(screen.getAllByText("확인 필요").some((el) => el.className.includes("warn"))).toBe(true);
    second.unmount();

    const urgent = result();
    const urgentCard = toBenefitResultCardData(urgent, "2026-09-02")!;
    render(<BenefitResultCard card={urgentCard} result={urgent} listing={listing} />);
    expect(screen.getByText("마감 임박")).toBeTruthy();
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

  it("합계에 든 일시금은 금색 상자 — 합계 밖 정액은 작은 카드에 잉크색으로, 보조 버튼 하나만 (11/18)", () => {
    const counted = result();
    const countedCard = toBenefitResultCardData(counted, "2026-09-02", new Set(["real-policy-id"]))!;
    const { unmount } = render(<BenefitResultCard card={countedCard} result={counted} listing={listing} />);
    expect(screen.getByText("예상 금액")).toBeTruthy();
    expect(screen.getByText("최대 50만원").className).toContain("text-accent-700");
    unmount();

    const fixed = result("조건충족시가능");
    fixed.estimatedAmount = 0;
    fixed.policy = { ...fixed.policy, lumpSumBasis: "fixedGrant", lumpSumCap: 100000, payoutNote: "전입 6개월 후 1회 지급" };
    const fixedCard = toBenefitResultCardData(fixed, "2026-09-02", new Set())!;
    render(<BenefitResultCard card={fixedCard} result={fixed} listing={listing} />);
    const article = screen.getByRole("article");
    // '확인 필요' 주황 배지는 두지 않는다 — 묶음 제목 '조건이 맞으면 더 받을 수 있는 지원'이 이미 말한다 (11/20)
    expect(within(article).queryByText("확인 필요")).toBeNull();
    expect(within(article).getByText("최대 10만원").className).not.toContain("accent");
    expect(within(article).getByText(/공고상 금액/)).toBeTruthy();
    // 합계 밖이라는 설명 · 자격 확인 안내는 그룹 설명이 한 번만 한다 — 카드마다 되풀이하지 않는다
    expect(within(article).queryByText(/위 합계에는 넣지 않았어요/)).toBeNull();
    expect(within(article).queryByText("자격 조건은 신청 준비에서 확인해요")).toBeNull();
    expect(article.querySelector("details")).toBeNull();
    const cta = within(article).getByRole("link", { name: "신청 준비 시작하기" });
    expect(cta.className).not.toContain("bg-brand-600");
    expect(cta.className).toMatch(/min-h-(?:11|\[50px\])/);
  });

  it("매달 주는 지원은 한 달 금액을 크게, 개월 합계를 아래에 (금액이 '매달 254만원'으로 읽히지 않게)", () => {
    const monthly = result();
    monthly.policy = { ...monthly.policy, benefitType: "rent_capped_monthly", monthlyCap: 212000, lumpSumBasis: undefined, lumpSumCap: undefined };
    monthly.estimatedAmount = 2544000;
    const card = toBenefitResultCardData(monthly, "2026-09-02", new Set(["real-policy-id"]))!;
    render(<BenefitResultCard card={card} result={monthly} listing={makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12 })} />);
    expect(screen.getByText("월 21만 2,000원").className).toContain("text-accent-700");
    expect(screen.getByText("12개월이면 254만 4,000원")).toBeTruthy();
    expect(screen.queryByText(/거주 기간 동안/)).toBeNull();
  });

  it("확인 필요도 결과에서 조건을 따지지 않는다 — 신청 준비로 이어 가고, 자격 확인은 거기서 한다고만 밝힌다 (11/17)", () => {
    const policyResult = result("조건충족시가능");
    const card = toBenefitResultCardData(policyResult, "2026-09-02");
    if (!card) throw new Error("카드 생성 실패");
    render(<BenefitResultCard card={card} result={policyResult} listing={listing} />);

    // 자격이 확정되지 않았다는 배지는 남긴다(토글 밖)
    expect(screen.getAllByText("확인 필요").some((el) => el.closest("details") === null)).toBe(true);
    expect(screen.queryByText(/가지 정보가 더 필요해요/)).toBeNull();
    expect(screen.queryByRole("link", { name: /조건 \d+개 확인하기/ })).toBeNull();
    expect(screen.getByRole("link", { name: "신청 준비 시작하기" }).getAttribute("href")).toBe(
      "/find/policies/real-policy-id/prepare",
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
