// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { longestCompleteStreak, readBadgeFacts } from "@/lib/badge-facts";
import { emptyLedger, ledgerMonth, ledgerPlan, toggleLine, type LedgerRecord } from "@/lib/ledger";
import { policiesForRegion } from "@/lib/region";
import { markGuideRead, saveChecklist, saveListing, saveProfile, saveSavedList } from "@/lib/storage";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { makeListing, makeProfile } from "./fixtures";

/** 배지 판정 재료 — 이 기기 기록에서 (내 프로필 설계 §7) */

const POLICIES = policiesJson as PolicyMeta[];
const TODAY = "2026-11-22";

beforeEach(() => window.localStorage.clear());

describe("readBadgeFacts", () => {
  it("아무 기록이 없으면 다 비어 있다", () => {
    expect(readBadgeFacts(TODAY)).toMatchObject({
      calculated: false, saved: 0, prepStarted: false, guidesRead: 0, guidesTotal: 4, ledgerAny: false, ledgerStreak: 0,
    });
  });

  it("계산 · 관심 · 신청 준비 · 가이드 읽음을 센다", () => {
    saveListing(makeListing());
    saveProfile(makeProfile());
    saveSavedList([POLICIES[0].id, POLICIES[1].id]);
    saveChecklist(POLICIES[0].id, { eligibility: true, period: false, documents: false });
    markGuideRead("before-contract");
    const facts = readBadgeFacts(TODAY);
    expect(facts.calculated).toBe(true);
    expect(facts.saved).toBe(2);
    expect(facts.prepStarted).toBe(true);
    expect(facts.prepBest!.done).toBeGreaterThan(0);
    expect(facts.guidesRead).toBe(1);
  });
});

describe("longestCompleteStreak — 그 달 칸을 다 체크한 달이 이어진 수", () => {
  const listing = makeListing({ contractStartDate: "2026-09-01", months: 12 });
  const profile = makeProfile();
  const plan = ledgerPlan(listing, buildCalculationSummary(policiesForRegion(POLICIES, listing.region), profile, listing, TODAY), profile.birthDate);
  const fill = (record: LedgerRecord, month: string): LedgerRecord =>
    ledgerMonth(plan, record, month).lines.reduce((r, line) => toggleLine(r, month, line.key, line.amount), record);

  it("3달 연속이면 3, 사이가 비면 끊긴다, 한 칸이라도 덜 적은 달은 세지 않는다", () => {
    let record = emptyLedger();
    for (const m of ["2026-09", "2026-10", "2026-11"]) record = fill(record, m);
    expect(longestCompleteStreak(plan, record)).toBe(3);

    let gap = emptyLedger();
    for (const m of ["2026-09", "2026-10", "2026-12"]) gap = fill(gap, m);
    expect(longestCompleteStreak(plan, gap)).toBe(2);

    const first = ledgerMonth(plan, emptyLedger(), "2026-09").lines[0];
    const partial = toggleLine(emptyLedger(), "2026-09", first.key, first.amount);
    const lines = ledgerMonth(plan, emptyLedger(), "2026-09").lines.length;
    expect(longestCompleteStreak(plan, partial)).toBe(lines === 1 ? 1 : 0);
  });
});
