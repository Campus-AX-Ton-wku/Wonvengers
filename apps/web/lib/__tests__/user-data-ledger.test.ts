import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION, MAX_LEDGER_AMOUNT, MAX_LEDGER_MONTHS, SCHEMA_VERSION, emptyContent, isEmptyContent, ledgerForSync,
  sameContent, sanitizeContent, validateUserData,
} from "../user-data";

/** 주거비 달력 · 집 보기 체크리스트 계정 저장 (11/23 ggue) — 서버가 받는 두 칸 */

const payload = (over: Record<string, unknown> = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  consentVersion: CONSENT_VERSION,
  consentAt: "2026-11-23T00:00:00.000Z",
  ...emptyContent(),
  ...over,
});
const ledger = {
  v: 1,
  months: { "2026-11": { done: { rent: 400_000, "policy:iksan-youth-rent": 200_000 }, amounts: { fee: 55_000 } } },
  oneTime: { "iksan-newcomer-moving-cost-support": "2026-11" },
};

describe("주거비 달력 칸 (11/23)", () => {
  it("빈 묶음은 기록 없음(null) · 체크 없음", () => {
    expect(emptyContent().ledger).toBeNull();
    expect(emptyContent().houseChecklist).toEqual([]);
  });

  it("두 칸이 없는 예전 저장(예전 앱 · 예전 서버 항목)도 통과하고 없음 · 빈 목록으로 읽힌다", () => {
    const { ledger: _l, houseChecklist: _h, ...old } = payload();
    const r = validateUserData(old);
    expect(r.ok && r.value.ledger).toBeNull();
    expect(r.ok && r.value.houseChecklist).toEqual([]);
  });

  it("올바른 기록은 그대로 받는다", () => {
    const r = validateUserData(payload({ ledger }));
    expect(r.ok && r.value.ledger).toEqual(ledger);
  });

  it("빈 달은 버리고, 남는 것이 없으면 null — 다 취소한 기록은 기록 없음과 같다", () => {
    const withEmpty = { ...ledger, months: { ...ledger.months, "2026-12": { done: {}, amounts: {} } } };
    const r = validateUserData(payload({ ledger: withEmpty }));
    expect(r.ok && Object.keys(r.value.ledger!.months)).toEqual(["2026-11"]);
    const empty = validateUserData(payload({ ledger: { v: 1, months: { "2026-11": { done: {}, amounts: {} } }, oneTime: {} } }));
    expect(empty.ok && empty.value.ledger).toBeNull();
  });

  it.each([
    ["버전이 다름", { ...ledger, v: 2 }],
    ["모르는 칸", { ...ledger, extra: 1 }],
    ["달 형식이 아님", { ...ledger, months: { "2026-13": { done: { rent: 1 }, amounts: {} } } }],
    ["달 안에 모르는 칸", { ...ledger, months: { "2026-11": { done: {}, amounts: {}, memo: "x" } } }],
    ["금액 0", { ...ledger, months: { "2026-11": { done: { rent: 0 }, amounts: {} } } }],
    ["금액 음수", { ...ledger, months: { "2026-11": { done: { rent: -1 }, amounts: {} } } }],
    ["금액 소수", { ...ledger, months: { "2026-11": { done: { rent: 1.5 }, amounts: {} } } }],
    ["금액 상한 넘음", { ...ledger, months: { "2026-11": { done: { rent: MAX_LEDGER_AMOUNT + 1 }, amounts: {} } } }],
    ["금액이 글자", { ...ledger, months: { "2026-11": { done: { rent: "400000" }, amounts: {} } } }],
    ["줄 키에 빈칸", { ...ledger, months: { "2026-11": { done: { "월 세": 1 }, amounts: {} } } }],
    ["한 번 받는 지원 id 형식", { ...ledger, oneTime: { "Bad Id": "2026-11" } }],
    ["한 번 받는 지원 달 형식", { ...ledger, oneTime: { "iksan-x": "2026-11-01" } }],
  ])("틀린 기록은 거절한다 — %s", (_why, bad) => {
    expect(validateUserData(payload({ ledger: bad })).ok).toBe(false);
  });

  it(`달이 ${MAX_LEDGER_MONTHS}개를 넘으면 거절한다`, () => {
    const months: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_LEDGER_MONTHS; i++) {
      months[`${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`] = { done: { rent: 1 }, amounts: {} };
    }
    expect(validateUserData(payload({ ledger: { v: 1, months, oneTime: {} } })).ok).toBe(false);
  });

  it("ledgerForSync — 이 기기 기록에서 서버가 거절할 줄만 빼고 나머지는 올린다", () => {
    const local = {
      v: 1 as const,
      months: {
        "2026-11": { done: { rent: 400_000, "월 세": 1 }, amounts: { fee: MAX_LEDGER_AMOUNT + 1 } },
        "2026-12": { done: {}, amounts: {} },
      },
      oneTime: { "iksan-x": "2026-11", "Bad Id": "2026-11" },
    };
    expect(ledgerForSync(local)).toEqual({
      v: 1,
      months: { "2026-11": { done: { rent: 400_000 }, amounts: {} } },
      oneTime: { "iksan-x": "2026-11" },
    });
    expect(ledgerForSync({ v: 1, months: {}, oneTime: {} })).toBeNull();
  });

  it("사본 다듬기(sanitizeContent)에서 깨진 기록은 그 칸만 버린다", () => {
    const base = { answers: emptyContent().answers, listing: null, profile: null, declared: null, checklists: {} };
    expect(sanitizeContent({ ...base, ledger: { v: 9 } }).ledger).toBeNull();
    expect(sanitizeContent({ ...base, ledger }).ledger).toEqual(ledger);
  });
});

describe("집 보기 체크리스트 칸 (11/23)", () => {
  it("이름순 · 중복 없이 받는다", () => {
    const r = validateUserData(payload({ houseChecklist: ["water", "mold", "water"] }));
    expect(r.ok && r.value.houseChecklist).toEqual(["mold", "water"]);
  });

  it.each([
    ["목록이 아님", { water: true }],
    ["id 형식", ["Water!"]],
    ["글자가 아님", [1]],
    ["61개", Array.from({ length: 61 }, (_, i) => `item-${i}`)],
  ])("틀린 체크는 거절한다 — %s", (_why, bad) => {
    expect(validateUserData(payload({ houseChecklist: bad })).ok).toBe(false);
  });
});

describe("비교 · 빈 묶음", () => {
  it("기록이나 체크가 있으면 빈 묶음이 아니고, 서로 다르면 다른 묶음이다", () => {
    expect(isEmptyContent({ ...emptyContent(), ledger: ledger as never })).toBe(false);
    expect(isEmptyContent({ ...emptyContent(), houseChecklist: ["water"] })).toBe(false);
    expect(sameContent({ ...emptyContent(), houseChecklist: ["water"] }, emptyContent())).toBe(false);
  });
});
