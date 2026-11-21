import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import {
  FEE_KEY,
  RENT_KEY,
  addMonths,
  emptyLedger,
  ledgerMonth,
  ledgerPlan,
  ledgerProgress,
  monthKeyOf,
  monthLabel,
  monthOnlyLabel,
  monthsBetween,
  oneTimeSupports,
  parseLedger,
  policyLineKey,
  receivedMonthLabel,
  setLineAmount,
  toggleLine,
  toggleOneTime,
  yearTotalLabel,
  type LedgerRecord,
} from "../ledger";
import type { CalculationSummary, PolicyMeta, PolicyResult, PolicyStatus } from "../types";
import { makeListing } from "./fixtures";

const policies = policiesJson as PolicyMeta[];
function real(id: string): PolicyMeta {
  const p = policies.find((x) => x.id === id);
  if (!p) throw new Error(`정책 없음: ${id}`);
  return p;
}
// 값이 DB 스냅숏에 흔들리지 않게 계산에 쓰는 칸은 여기서 고정한다
const 주거급여: PolicyMeta = { ...real("youth-housing-benefit-split-payment"), benefitType: "rent_capped_monthly", monthlyCap: 212_000, maxMonths: undefined };
const 익산월세: PolicyMeta = { ...real("iksan-youth-rent-support"), benefitType: "rent_capped_monthly", monthlyCap: 200_000, maxMonths: 3 };
const 전입장려금: PolicyMeta = { ...real("iksan-move-in-household-incentive"), benefitType: "lump_sum", lumpSumBasis: "fixedGrant", lumpSumCap: 100_000 };
const 이사비: PolicyMeta = { ...real("iksan-newcomer-moving-cost-support"), benefitType: "lump_sum", lumpSumBasis: "oneTimeMoveCost", lumpSumCap: 500_000 };
const 보증료: PolicyMeta = { ...real("jeonse-return-guarantee-fee-subsidy"), benefitType: "lump_sum", lumpSumBasis: "notCalculable", lumpSumCap: undefined };

function result(policy: PolicyMeta, status: PolicyStatus = "예상적용"): PolicyResult {
  return { policy, status, checks: [], passedLabels: [], failedLabels: [], unknownLabels: [], estimatedAmount: 0 };
}
function summary(results: PolicyResult[], included: string[]): CalculationSummary {
  return { nominalTotalCost: 0, maxSupportAmount: 0, finalEstimatedHousingCost: 0, bestCombination: { includedPolicyIds: included, totalAmount: 0 }, results };
}

// 시안 예시: 월세 40만 · 관리비 5만 · 2026년 9월 시작 12개월 · 청년 주거급여 분리지급 월 21만 2천원
const 월세 = makeListing({ contractType: "월세", rentOrYearlyAmount: 400_000, managementFee: 50_000, contractStartDate: "2026-09-01", months: 12 });
const 월세계획 = ledgerPlan(월세, summary([result(주거급여)], [주거급여.id]));
const 급여 = policyLineKey(주거급여.id);

/** 그 달 칸을 지금 금액으로 누른다 */
function press(record: LedgerRecord, month: string, ...keys: string[]): LedgerRecord {
  let next = record;
  for (const key of keys) {
    const line = ledgerMonth(월세계획, next, month).lines.find((l) => l.key === key);
    if (!line) throw new Error(`${month} 에 ${key} 칸 없음`);
    next = toggleLine(next, month, key, line.amount);
  }
  return next;
}

describe("달 열쇠", () => {
  it("날짜 → 달, 더하기 · 빼기는 해를 넘긴다, 사이 개월, 읽는 글", () => {
    expect(monthKeyOf("2026-11-21")).toBe("2026-11");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2026-09", "2027-08")).toBe(11);
    expect(monthLabel("2026-09")).toBe("2026년 9월");
    expect(monthOnlyLabel("2026-10")).toBe("10월");
    expect(receivedMonthLabel("2026-10", "2026-11")).toBe("10월");
    expect(receivedMonthLabel("2025-12", "2026-01")).toBe("2025년 12월");
    expect(yearTotalLabel("2026-11", "2026-11")).toBe("올해 누적");
    expect(yearTotalLabel("2027-01", "2026-11")).toBe("2027년 누적");
  });
});

describe("계획 (ledgerPlan)", () => {
  it("계약 기간 · 금액 · 합계에 든 월 지원만 — 일시금과 합계 밖 지원은 들어오는 돈이 아니다", () => {
    const plan = ledgerPlan(월세, summary([result(주거급여), result(익산월세), result(전입장려금)], [주거급여.id, 전입장려금.id]));
    expect(plan).toMatchObject({ start: "2026-09", end: "2027-08", months: 12, contractType: "월세", rent: 400_000, fee: 50_000 });
    expect(plan.incomes.map((i) => [i.policy.id, i.monthly, i.months])).toEqual([[주거급여.id, 212_000, 12]]);
  });
});

describe("한 달 (ledgerMonth) — 시안 예시 값", () => {
  // 9월: 셋 다 · 10월: 셋 다 + 관리비 4만 2천으로 고침 · 11월: 월세만
  let record = press(emptyLedger(), "2026-09", RENT_KEY, FEE_KEY, 급여);
  record = setLineAmount(record, "2026-10", { key: FEE_KEY, planned: 50_000 }, 42_000);
  record = press(record, "2026-10", RENT_KEY, FEE_KEY, 급여);
  record = press(record, "2026-11", RENT_KEY);

  it("9월 — 다 누름: 실제 부담 = 예상 = 23만 8천, 누적도 같다", () => {
    const v = ledgerMonth(월세계획, record, "2026-09");
    expect(v).toMatchObject({ inContract: true, contractMonth: 1, actual: 238_000, expected: 238_000, pending: false, yearTotal: 238_000 });
    expect(v.lines.map((l) => [l.key, l.side, l.label, l.amount, l.done])).toEqual([
      [RENT_KEY, "out", "월세", 400_000, true],
      [FEE_KEY, "out", "관리비", 50_000, true],
      [급여, "in", 주거급여.name, 212_000, true],
    ]);
  });

  it("10월 — 고친 관리비로 실제 부담 23만, 예상은 계산값 23만 8천, 누적 46만 8천", () => {
    const v = ledgerMonth(월세계획, record, "2026-10");
    expect(v).toMatchObject({ contractMonth: 2, actual: 230_000, expected: 238_000, pending: false, yearTotal: 468_000 });
    expect(v.lines.find((l) => l.key === FEE_KEY)).toMatchObject({ amount: 42_000, planned: 50_000, edited: true, done: true });
  });

  it("11월 — 월세만: 실제 부담 40만, 안 누른 칸 있음, 누적 86만 8천", () => {
    const v = ledgerMonth(월세계획, record, "2026-11");
    expect(v).toMatchObject({ contractMonth: 3, actual: 400_000, expected: 238_000, pending: true, yearTotal: 868_000 });
  });

  it("다음 해 1월의 누적은 그 해 1월부터만 센다", () => {
    const r = press(record, "2027-01", RENT_KEY);
    expect(ledgerMonth(월세계획, r, "2027-01").yearTotal).toBe(400_000);
  });

  it("계약 기간 밖 — 칸 없음, 부담 0", () => {
    for (const month of ["2026-08", "2027-09"]) {
      expect(ledgerMonth(월세계획, record, month)).toMatchObject({ inContract: false, lines: [], actual: 0, expected: 0, pending: false });
    }
  });
});

describe("한 달 — 연세 · 짧은 지원 · 음수 · 관리비 0", () => {
  const 연세 = makeListing({ contractType: "연세", rentOrYearlyAmount: 4_800_000, managementFee: 50_000, contractStartDate: "2026-09-01", months: 12 });
  const plan = ledgerPlan(연세, summary([result(주거급여)], [주거급여.id]));

  it("연세는 시작 달에만, 보조문과 함께. 시작 달 연세 · 관리비 냄 → 485만, 예상 463만 8천", () => {
    let r = toggleLine(emptyLedger(), "2026-09", RENT_KEY, 4_800_000);
    r = toggleLine(r, "2026-09", FEE_KEY, 50_000);
    const v = ledgerMonth(plan, r, "2026-09");
    expect(v.lines[0]).toMatchObject({ key: RENT_KEY, label: "연세", note: "연세는 계약 시작 달에 한 번만 나와요" });
    expect(v).toMatchObject({ actual: 4_850_000, expected: 4_638_000, pending: true });
    expect(ledgerMonth(plan, r, "2026-10").lines.map((l) => l.key)).toEqual([FEE_KEY, 급여]);
  });

  it("받은 지원이 낸 돈보다 크면 실제 부담 · 예상이 음수 그대로 (화면이 '0원 · 더 많아요'로 바꾼다)", () => {
    let r = toggleLine(emptyLedger(), "2026-10", FEE_KEY, 50_000);
    r = toggleLine(r, "2026-10", 급여, 212_000);
    const v = ledgerMonth(plan, r, "2026-10");
    expect(v.actual).toBe(-162_000);
    expect(v.expected).toBe(-162_000);
  });

  it("지원 개월 수가 계약보다 짧으면 그 뒤 달엔 들어오는 돈 줄이 없다", () => {
    const p = ledgerPlan(월세, summary([result(익산월세)], [익산월세.id]));
    expect(ledgerMonth(p, emptyLedger(), "2026-11").lines.some((l) => l.side === "in")).toBe(true);
    expect(ledgerMonth(p, emptyLedger(), "2026-12").lines.some((l) => l.side === "in")).toBe(false);
  });

  it("관리비 0원이면 관리비 칸이 없다", () => {
    const p = ledgerPlan(makeListing({ contractType: "월세", rentOrYearlyAmount: 400_000, managementFee: 0, contractStartDate: "2026-09-01" }), summary([], []));
    expect(ledgerMonth(p, emptyLedger(), "2026-09").lines.map((l) => l.key)).toEqual([RENT_KEY]);
  });
});

describe("다시 계산하면 (결정 ⑤)", () => {
  it("누른 칸 · 고친 칸은 그대로, 안 누른 칸만 새 계산값", () => {
    let r = toggleLine(emptyLedger(), "2026-11", RENT_KEY, 400_000);
    r = setLineAmount(r, "2026-11", { key: FEE_KEY, planned: 50_000 }, 42_000);
    const 새계획 = ledgerPlan({ ...월세, rentOrYearlyAmount: 450_000, managementFee: 60_000 }, summary([], []));
    const nov = ledgerMonth(새계획, r, "2026-11");
    expect(nov.lines.map((l) => [l.key, l.amount, l.planned])).toEqual([
      [RENT_KEY, 400_000, 450_000],
      [FEE_KEY, 42_000, 60_000],
    ]);
    expect(ledgerMonth(새계획, r, "2026-12").lines.map((l) => l.amount)).toEqual([450_000, 60_000]);
  });
});

describe("기록 바꾸기", () => {
  it("toggleLine — 누르면 그때 금액을 남기고, 다시 누르면 지운다", () => {
    const on = toggleLine(emptyLedger(), "2026-11", RENT_KEY, 400_000);
    expect(on.months["2026-11"].done).toEqual({ [RENT_KEY]: 400_000 });
    expect(toggleLine(on, "2026-11", RENT_KEY, 400_000).months["2026-11"].done).toEqual({});
  });

  it("setLineAmount — 계산값과 같거나 비우면 고친 값이 없어지고, 누른 칸이면 누른 금액도 따라간다", () => {
    let r = toggleLine(emptyLedger(), "2026-10", FEE_KEY, 50_000);
    r = setLineAmount(r, "2026-10", { key: FEE_KEY, planned: 50_000 }, 42_000);
    expect(r.months["2026-10"]).toEqual({ done: { [FEE_KEY]: 42_000 }, amounts: { [FEE_KEY]: 42_000 } });
    r = setLineAmount(r, "2026-10", { key: FEE_KEY, planned: 50_000 }, null);
    expect(r.months["2026-10"]).toEqual({ done: { [FEE_KEY]: 50_000 }, amounts: {} });
    r = setLineAmount(r, "2026-10", { key: FEE_KEY, planned: 50_000 }, 50_000);
    expect(r.months["2026-10"].amounts).toEqual({});
  });

  it("toggleOneTime — 받은 달을 남기고, 다시 누르면 지운다", () => {
    const on = toggleOneTime(emptyLedger(), 이사비.id, "2026-10");
    expect(on.oneTime).toEqual({ [이사비.id]: "2026-10" });
    expect(toggleOneTime(on, 이사비.id, "2026-11").oneTime).toEqual({});
  });

  it("바꾸기는 원래 기록을 건드리지 않는다", () => {
    const base = emptyLedger();
    toggleLine(base, "2026-11", RENT_KEY, 1);
    toggleOneTime(base, "x", "2026-11");
    expect(base).toEqual(emptyLedger());
  });
});

describe("parseLedger — 저장값 검사", () => {
  it("모양이 틀리면 빈 기록, 틀린 부분만 버린다", () => {
    expect(parseLedger(null)).toEqual(emptyLedger());
    expect(parseLedger("x")).toEqual(emptyLedger());
    expect(parseLedger({ v: 2, months: {} })).toEqual(emptyLedger());
    expect(
      parseLedger({
        v: 1,
        months: { "2026-11": { done: { rent: 400000, fee: -1, x: "a" }, amounts: { fee: 42000.4 } }, "2026-13": { done: {} }, bad: 1 },
        oneTime: { a: "2026-10", b: "10월", c: 3 },
      })
    ).toEqual({ v: 1, months: { "2026-11": { done: { rent: 400000 }, amounts: { fee: 42000 } } }, oneTime: { a: "2026-10" } });
  });
});

describe("한 번 받는 지원 (oneTimeSupports)", () => {
  it("일시금 중 가능성 있음 · 확인 필요만, 결과 순서대로. 정액은 금액, 실비는 '최대', 상한이 없으면 금액 없음", () => {
    const s = summary(
      [result(주거급여), result(전입장려금, "조건충족시가능"), result(이사비), result(보증료, "조건충족시가능"), result({ ...이사비, id: "x" }, "대상아님"), result({ ...이사비, id: "y" }, "신청불가")],
      [주거급여.id]
    );
    expect(oneTimeSupports(s).map((o) => [o.policy.id, o.amountText])).toEqual([
      [전입장려금.id, "10만원"],
      [이사비.id, "최대 50만원"],
      [보증료.id, null],
    ]);
  });
});

describe("홈 진행 상태 (ledgerProgress)", () => {
  it("낸 돈 · 받은 지원 개수, 다 누르면 complete, 기간 밖이면 null", () => {
    const r = press(emptyLedger(), "2026-11", RENT_KEY);
    expect(ledgerProgress(ledgerMonth(월세계획, r, "2026-11"))).toEqual({ outDone: 1, outTotal: 2, inDone: 0, inTotal: 1, complete: false });
    const all = press(r, "2026-11", FEE_KEY, 급여);
    expect(ledgerProgress(ledgerMonth(월세계획, all, "2026-11"))?.complete).toBe(true);
    expect(ledgerProgress(ledgerMonth(월세계획, r, "2026-08"))).toBeNull();
  });
});
