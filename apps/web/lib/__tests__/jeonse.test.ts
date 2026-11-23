// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { monthlyJeonseInterest, monthlyRentEquivalent, nominalTotalCost } from "../rent";
import { emptyContent, CONSENT_VERSION, SCHEMA_VERSION, validateUserData } from "../user-data";
import { RENT_KEY, ledgerMonth, ledgerPlan, emptyLedger } from "../ledger";
import { evaluatePolicy } from "../eligibility";
import { benefitFormula, monthlyBreakdown } from "../benefit";
import { saveListing, loadListing } from "../storage";
import type { CalculationSummary, PolicyMeta } from "../types";
import { makeListing, makeProfile } from "./fixtures";

/**
 * 전세 계산 (11/23 ggue A안) — 월 부담 = 대출 이자(대출 금액 × 연 금리 ÷ 12) + 관리비.
 * 보증금은 돌려받는 돈이라 넣지 않는다. 내 돈으로 낸 보증금의 기회비용도 넣지 않는다.
 */

const policies = policiesJson as PolicyMeta[];
const real = (id: string) => policies.find((p) => p.id === id)!;

// 전세 1억 · 그중 대출 8천만원 · 연 2.4% · 관리비 7만원 · 24개월
const 전세 = makeListing({
  contractType: "전세",
  deposit: 100_000_000,
  rentOrYearlyAmount: 0,
  jeonseLoanAmount: 80_000_000,
  jeonseLoanRate: 2.4,
  managementFee: 70_000,
  months: 24,
});

describe("전세 월 이자", () => {
  it("대출 금액 × 연 금리 ÷ 12 를 원 단위로 반올림한다", () => {
    expect(monthlyJeonseInterest(전세)).toBe(160_000); // 8천만 × 2.4% = 192만 ÷ 12
    expect(monthlyJeonseInterest(makeListing({ contractType: "전세", jeonseLoanAmount: 10_000_000, jeonseLoanRate: 2.35 }))).toBe(19_583);
  });

  it("월 환산 임대료 자리에 이자가 들어간다 — 영수증 · 홈 · 달력이 같은 값을 쓴다", () => {
    expect(monthlyRentEquivalent(전세)).toBe(160_000);
    expect(nominalTotalCost(전세)).toBe((160_000 + 70_000) * 24);
  });

  it("대출이 없으면 이자는 0 — 관리비만 낸다", () => {
    const 대출없음 = { ...전세, jeonseLoanAmount: 0, jeonseLoanRate: undefined };
    expect(monthlyRentEquivalent(대출없음)).toBe(0);
    expect(nominalTotalCost(대출없음)).toBe(70_000 * 24);
  });

  it("전세 칸이 남아 있어도 월세 · 연세 계산은 그대로다", () => {
    expect(monthlyRentEquivalent({ ...전세, contractType: "월세", rentOrYearlyAmount: 350_000 })).toBe(350_000);
  });
});

describe("저장 — 전세 칸은 전세 계약에만 남긴다", () => {
  it("월세 · 연세로 저장하면 전세 칸을 지운다 — 예전 서버가 모르는 키라 거부한다", () => {
    saveListing({ ...전세, contractType: "월세", rentOrYearlyAmount: 350_000 });
    const saved = loadListing()!;
    expect(saved).not.toHaveProperty("jeonseLoanAmount");
    expect(saved).not.toHaveProperty("jeonseLoanRate");
  });

  it("전세로 저장하면 그대로 남는다", () => {
    saveListing(전세);
    expect(loadListing()).toMatchObject({ contractType: "전세", jeonseLoanAmount: 80_000_000, jeonseLoanRate: 2.4 });
  });
});

describe("서버 형식 검사", () => {
  const payload = (listing: unknown) => ({
    schemaVersion: SCHEMA_VERSION,
    consentVersion: CONSENT_VERSION,
    consentAt: "2026-11-23T00:00:00.000Z",
    ...emptyContent(),
    listing,
  });

  it("전세 계약과 두 칸을 받는다", () => {
    const r = validateUserData(payload(전세));
    expect(r.ok && r.value.listing).toEqual(전세);
  });

  it("두 칸이 없는 예전 월세 · 연세 저장도 그대로 받는다", () => {
    const { jeonseLoanAmount: _a, jeonseLoanRate: _b, ...old } = makeListing();
    const r = validateUserData(payload(old));
    expect(r.ok && r.value.listing).toEqual(old);
  });

  it.each([
    ["금리가 음수", { ...전세, jeonseLoanRate: -1 }, "data.listing.jeonseLoanRate: out of range"],
    ["금리가 30% 초과", { ...전세, jeonseLoanRate: 31 }, "data.listing.jeonseLoanRate: out of range"],
    ["대출 금액이 소수", { ...전세, jeonseLoanAmount: 1.5 }, "data.listing.jeonseLoanAmount: out of range"],
    ["모르는 계약 형태", { ...전세, contractType: "반전세" }, "data.listing.contractType: not allowed"],
  ])("%s 이면 거부한다", (_name, listing, error) => {
    expect(validateUserData(payload(listing))).toEqual({ ok: false, error });
  });
});

describe("주거비 달력 — 전세는 매달 대출 이자", () => {
  const summary: CalculationSummary = {
    nominalTotalCost: 0,
    maxSupportAmount: 0,
    finalEstimatedHousingCost: 0,
    bestCombination: { includedPolicyIds: [], totalAmount: 0 },
    results: [],
  };

  it("매달 '전세대출 이자'와 관리비 칸이 생긴다", () => {
    const plan = ledgerPlan({ ...전세, contractStartDate: "2026-09-01" }, summary);
    for (const month of ["2026-09", "2027-08"]) {
      const lines = ledgerMonth(plan, emptyLedger(), month).lines;
      expect(lines.map((l) => [l.key, l.label, l.planned])).toEqual([
        [RENT_KEY, "전세대출 이자", 160_000],
        ["fee", "관리비", 70_000],
      ]);
    }
  });

  it("대출이 없으면 관리비 칸만 있다", () => {
    const plan = ledgerPlan({ ...전세, jeonseLoanAmount: 0, contractStartDate: "2026-09-01" }, summary);
    expect(ledgerMonth(plan, emptyLedger(), "2026-09").lines.map((l) => l.label)).toEqual(["관리비"]);
  });
});

describe("판정 — 계약 형태 조건", () => {
  const profile = makeProfile();
  const asOf = "2026-11-23";

  it("월세 · 연세 계약만 받는 지원은 전세 계약이면 대상이 아니다", () => {
    // 접수 기간 검사가 먼저라 기간을 열어 둔다 — 2026년 회차는 이미 닫혔다
    const 청년월세 = { ...real("moland-youth-rent-support"), applicationEnd: null };
    const r = evaluatePolicy(청년월세, profile, 전세, asOf);
    expect(r.status).toBe("대상아님");
    expect(r.failedLabels[0]).toContain("계약만 신청할 수 있어요");
  });

  it("계약 형태를 따지지 않는 월세 상한 지원(주거급여)은 전세면 금액을 계산하지 않고 확인할 것으로 남긴다", () => {
    // 월 환산 월세 자리에 들어간 대출 이자로 지급액을 셀 수 없다 — 이자는 집주인에게 내는 돈이 아니다
    const r = evaluatePolicy(real("youth-housing-benefit-split-payment"), profile, 전세, asOf);
    expect(r.status).not.toBe("예상적용");
    expect(r.estimatedAmount).toBe(0);
    expect(r.unknownLabels.join(" ")).toContain("전세 계약의 지급액");
    expect(monthlyBreakdown(real("youth-housing-benefit-split-payment"), 전세)).toEqual({ monthly: 0, months: 24 });
    expect(benefitFormula(real("youth-housing-benefit-split-payment"), 전세)).toContain("전세 계약은 매달 내는 월세가 없어");
  });

  it("전세 전용 보증료 지원은 계약 형태에서 막히지 않는다", () => {
    const r = evaluatePolicy(real("jeonse-return-guarantee-fee-subsidy"), profile, 전세, asOf);
    expect(r.failedLabels.join(" ")).not.toContain("계약만 신청할 수 있어요");
  });
});
