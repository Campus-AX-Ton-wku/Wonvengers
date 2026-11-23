import { describe, expect, it } from "vitest";
import { BADGES, badgeStatuses, newBadges, nextBadge, type BadgeFacts } from "../badges";
import { BADGE_IDS } from "../user-data";

/** 내 프로필 ② 배지 판정 (docs/기획/2026-11-22-내-프로필-설계.md §7) */

const none: BadgeFacts = {
  calculated: false,
  saved: 0,
  prepStarted: false,
  prepBest: null,
  guidesRead: 0,
  guidesTotal: 3,
  ledgerAny: false,
  ledgerStreak: 0,
};
const met = (facts: Partial<BadgeFacts>) =>
  badgeStatuses({ ...none, ...facts }).filter((s) => s.met).map((s) => s.id);

describe("배지 8개", () => {
  it("검사 목록과 같은 순서 · 이름 · 기존 3D 그림", () => {
    expect(BADGES.map((b) => b.id)).toEqual([...BADGE_IDS]);
    expect(BADGES.map((b) => b.label)).toEqual(["첫 계산", "첫 관심", "관심 5개", "준비 시작", "준비 끝", "가이드 정독", "달력 첫 기록", "3달 꼬박"]);
    expect(BADGES.map((b) => b.icon)).toEqual(["calculator", "housing-benefit", "wallet", "contract", "receipt", "guarantee", "rent", "move-in"]);
  });

  it("아무것도 안 했으면 하나도 없다 — 진행이 있는 배지는 0/목표", () => {
    const s = badgeStatuses(none);
    expect(s.every((x) => !x.met)).toBe(true);
    expect(s.find((x) => x.id === "save_5")?.progress).toEqual({ done: 0, total: 5 });
    expect(s.find((x) => x.id === "guide_read")?.progress).toEqual({ done: 0, total: 3 });
    expect(s.find((x) => x.id === "ledger_3months")?.progress).toEqual({ done: 0, total: 3 });
    expect(s.find((x) => x.id === "first_calc")?.progress).toBeNull();
  });

  it("판정 — 계산 · 관심 1 · 관심 5 · 준비 시작 · 준비 끝 · 가이드 3편 · 달력 첫 · 3달 연속", () => {
    expect(met({ calculated: true })).toEqual(["first_calc"]);
    expect(met({ saved: 1 })).toEqual(["first_save"]);
    expect(met({ saved: 5 })).toEqual(["first_save", "save_5"]);
    expect(met({ prepStarted: true, prepBest: { done: 1, total: 4 } })).toEqual(["prep_start"]);
    expect(met({ prepStarted: true, prepBest: { done: 4, total: 4 } })).toEqual(["prep_start", "prep_done"]);
    expect(met({ guidesRead: 2 })).toEqual([]);
    expect(met({ guidesRead: 3 })).toEqual(["guide_read"]);
    expect(met({ ledgerAny: true, ledgerStreak: 2 })).toEqual(["ledger_first"]);
    expect(met({ ledgerAny: true, ledgerStreak: 3 })).toEqual(["ledger_first", "ledger_3months"]);
  });

  it("진행은 목표를 넘지 않는다 — 관심 7개여도 5/5", () => {
    const s = badgeStatuses({ ...none, saved: 7, prepBest: { done: 2, total: 4 }, ledgerStreak: 5 });
    expect(s.find((x) => x.id === "save_5")?.progress).toEqual({ done: 5, total: 5 });
    expect(s.find((x) => x.id === "prep_done")?.progress).toEqual({ done: 2, total: 4 });
    expect(s.find((x) => x.id === "ledger_3months")?.progress).toEqual({ done: 3, total: 3 });
  });
});

describe("새로 받은 배지 · 다음 배지", () => {
  it("조건을 채웠고 아직 안 받은 것만, 정해진 순서로 — 한 번 받은 배지는 조건이 사라져도 남는다(다시 받지 않음)", () => {
    const s = badgeStatuses({ ...none, calculated: true, saved: 1 });
    expect(newBadges(s, {})).toEqual(["first_calc", "first_save"]);
    expect(newBadges(s, { first_calc: "2026-11-18" })).toEqual(["first_save"]);
    expect(newBadges(badgeStatuses(none), { first_save: "2026-11-19" })).toEqual([]);
  });

  it("다음 배지 — 안 받았고 조건도 아직인 첫 배지 (방금 받은 것은 뺀다)", () => {
    const s = badgeStatuses({ ...none, calculated: true });
    expect(nextBadge(s, { first_calc: "2026-11-22" })?.id).toBe("first_save");
    const all = Object.fromEntries(BADGE_IDS.map((id) => [id, "2026-11-22"]));
    expect(nextBadge(badgeStatuses(none), all)).toBeNull();
  });
});
