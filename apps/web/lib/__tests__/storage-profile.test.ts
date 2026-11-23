// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalContent, loadBadges, loadProfileCard, onLocalChange, readLocalContent, resetAllAnswers, saveAnswers,
  saveBadges, saveProfileCard, writeLocalContent,
} from "@/lib/storage";
import { emptyContent, type ProfileCardData } from "@/lib/user-data";

/** 내 프로필 ① — 이 기기 사본(perky.profile-card · perky.badges), 계정과 동기화 (설계 §1) */

const card: ProfileCardData = { icon: "student", color: "mint", name: "월세 2년 차", pinnedBadge: null };

beforeEach(() => window.localStorage.clear());

describe("프로필 · 배지 저장", () => {
  it("저장한 값을 읽는다. 없거나 깨졌으면 없음 · 빈 값", () => {
    expect(loadProfileCard()).toBeNull();
    expect(loadBadges()).toEqual({});
    saveProfileCard(card);
    saveBadges({ first_calc: "2026-11-18" });
    expect(loadProfileCard()).toEqual(card);
    expect(loadBadges()).toEqual({ first_calc: "2026-11-18" });
    window.localStorage.setItem("perky.profile-card", JSON.stringify({ ...card, icon: "rocket" }));
    window.localStorage.setItem("perky.badges", "{깨짐");
    expect(loadProfileCard()).toBeNull();
    expect(loadBadges()).toEqual({});
  });

  it("계정과 동기화한다 — 저장하면 알리고, 사본 묶음에 담기고, 서버 값으로 덮어쓴다", () => {
    const listener = vi.fn();
    const off = onLocalChange(listener);
    saveProfileCard(card);
    off();
    expect(listener).toHaveBeenCalled();
    saveBadges({ first_save: "2026-11-19" });
    expect(readLocalContent().profileCard).toEqual(card);
    expect(readLocalContent().badges).toEqual({ first_save: "2026-11-19" });

    writeLocalContent({ ...emptyContent(), profileCard: { ...card, color: "peach" }, badges: {} });
    expect(loadProfileCard()?.color).toBe("peach");
    expect(loadBadges()).toEqual({});
  });

  it("로그아웃(사본 지우기)은 지우고, '처음부터 다시'(답 비우기)는 남긴다", () => {
    saveAnswers({ birthDate: "2001-01-01", region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세" });
    saveProfileCard(card);
    saveBadges({ first_calc: "2026-11-18" });
    resetAllAnswers();
    expect(readLocalContent().answers.values.region).toBeNull();
    expect(loadProfileCard()).toEqual(card);
    expect(loadBadges()).toEqual({ first_calc: "2026-11-18" });

    clearLocalContent();
    expect(loadProfileCard()).toBeNull();
    expect(loadBadges()).toEqual({});
  });
});
