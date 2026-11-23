import { describe, expect, it } from "vitest";
import {
  BADGE_IDS, CONSENT_VERSION, SCHEMA_VERSION, contentOf, emptyContent, isEmptyContent, sameContent, sanitizeContent,
  validateUserData,
} from "../user-data";

/** 내 프로필 ① (docs/기획/2026-11-22-내-프로필-설계.md §1) — 계정에 저장하는 프로필 · 배지 칸 */

const payload = (over: Record<string, unknown> = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  consentVersion: CONSENT_VERSION,
  consentAt: "2026-11-22T00:00:00.000Z",
  ...emptyContent(),
  ...over,
});
const card = { icon: "student", color: "mint", name: "월세 독립 2년 차", pinnedBadge: null };

describe("프로필 · 배지 칸 (11/22)", () => {
  it("빈 묶음은 프로필 없음 · 배지 없음", () => {
    expect(emptyContent().profileCard).toBeNull();
    expect(emptyContent().badges).toEqual({});
    expect(BADGE_IDS).toHaveLength(8);
  });

  it("두 칸이 없는 예전 저장도 통과하고 없음 · 빈 값으로 읽힌다", () => {
    const { profileCard: _p, badges: _b, ...old } = payload();
    const r = validateUserData(old);
    expect(r.ok && r.value.profileCard).toBeNull();
    expect(r.ok && r.value.badges).toEqual({});
  });

  it("올바른 값 — 이름 없음(기본 이름) · 대표 배지 · 받은 날", () => {
    expect(validateUserData(payload({ profileCard: card })).ok).toBe(true);
    expect(validateUserData(payload({ profileCard: { ...card, name: null, pinnedBadge: "first_calc" } })).ok).toBe(true);
    expect(validateUserData(payload({ badges: { first_calc: "2026-11-18", save_5: "2026-11-20" } })).ok).toBe(true);
    expect(validateUserData(payload({ profileCard: { ...card, name: "가나다라마바사아자차" } })).ok).toBe(true); // 10자
  });

  it.each([
    ["모르는 그림", { profileCard: { ...card, icon: "rocket" } }],
    ["모르는 색", { profileCard: { ...card, color: "red" } }],
    ["11자 이름", { profileCard: { ...card, name: "가나다라마바사아자차카" } }],
    ["빈 이름", { profileCard: { ...card, name: "" } }],
    ["앞뒤 빈칸", { profileCard: { ...card, name: " 나 " } }],
    ["제어 문자", { profileCard: { ...card, name: "나\n너" } }],
    ["모르는 대표 배지", { profileCard: { ...card, pinnedBadge: "vip" } }],
    ["모르는 칸", { profileCard: { ...card, photo: "x" } }],
    ["모르는 배지", { badges: { vip: "2026-11-20" } }],
    ["날짜 아닌 받은 날", { badges: { first_calc: "어제" } }],
  ])("거절 — %s", (_, over) => {
    expect(validateUserData(payload(over)).ok).toBe(false);
  });

  it("이 기기 사본을 다듬을 때 깨진 프로필 · 배지는 그 칸만 버린다", () => {
    const content = sanitizeContent({ ...emptyContent(), profileCard: { icon: "x" }, badges: { first_calc: "2026-11-18" } });
    expect(content.profileCard).toBeNull();
    expect(content.badges).toEqual({ first_calc: "2026-11-18" });
  });

  it("빈 값 판정 · 답만 꺼내기 · 같은지 비교가 두 칸을 본다", () => {
    expect(isEmptyContent({ ...emptyContent(), profileCard: card as never })).toBe(false);
    expect(isEmptyContent({ ...emptyContent(), badges: { first_save: "2026-11-19" } })).toBe(false);
    expect(contentOf({ ...emptyContent(), profileCard: card as never }).profileCard).toEqual(card);
    expect(sameContent(emptyContent(), { ...emptyContent(), profileCard: card as never })).toBe(false);
  });
});
