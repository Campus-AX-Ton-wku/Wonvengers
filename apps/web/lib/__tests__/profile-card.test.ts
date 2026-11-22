import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_CARD, PROFILE_COLORS, PROFILE_ICONS, defaultProfileName, normalizeProfileName, profileName,
} from "../profile-card";
import { PROFILE_COLOR_IDS, PROFILE_ICON_IDS } from "../user-data";
import type { DiscoveryAnswers } from "../types";

/** 내 프로필 ① 화면 규칙 (docs/기획/2026-11-22-내-프로필-설계.md §2) */

const answers = (over: Partial<DiscoveryAnswers> = {}): DiscoveryAnswers => ({
  birthDate: "2001-03-01",
  region: "전북특별자치도 익산시",
  status: "대학생",
  incomeBracket: 1,
  housingType: "월세",
  ...over,
});

describe("기본 이름 — 사는 곳 + 사는 + 상태", () => {
  it("익산 사는 대학생 · 직장인 · 구직자", () => {
    expect(defaultProfileName(answers())).toBe("익산 사는 대학생");
    expect(defaultProfileName(answers({ status: "재직" }))).toBe("익산 사는 직장인");
    expect(defaultProfileName(answers({ status: "구직" }))).toBe("익산 사는 구직자");
  });

  it("하나만 있으면 있는 것만, 둘 다 없으면 '청년'", () => {
    expect(defaultProfileName(answers({ status: null }))).toBe("익산 사는 청년");
    expect(defaultProfileName(answers({ region: null }))).toBe("대학생");
    expect(defaultProfileName(answers({ region: null, status: null }))).toBe("청년");
  });

  it("시 · 도만 고른 값이면 시 · 도 약칭", () => {
    expect(defaultProfileName(answers({ region: "전북특별자치도" }))).toBe("전북 사는 대학생");
  });
});

describe("직접 정한 이름", () => {
  it("앞뒤 빈칸 · 줄바꿈을 정리하고, 비면 기본 이름(null), 10자에서 자른다(입력 칸도 10자까지만 받는다)", () => {
    expect(normalizeProfileName("  월세 2년 차 ")).toBe("월세 2년 차");
    expect(normalizeProfileName("   ")).toBeNull();
    expect(normalizeProfileName("가나다라마바사아자차")).toBe("가나다라마바사아자차");
    expect(normalizeProfileName("가나다라마바사아자차카")).toBe("가나다라마바사아자차");
    expect(normalizeProfileName("나\n너")).toBe("나 너");
  });

  it("보이는 이름 — 정한 이름이 있으면 그것, 없으면 기본 이름(기본 표시)", () => {
    expect(profileName(null, answers())).toEqual({ name: "익산 사는 대학생", isDefault: true });
    expect(profileName({ ...DEFAULT_PROFILE_CARD, name: "월세 2년 차" }, answers())).toEqual({ name: "월세 2년 차", isDefault: false });
  });
});

describe("그림 6 · 색 6 · 기본값", () => {
  it("검사 목록과 같은 순서 · 기본은 집 · 파랑 · 기본 이름", () => {
    expect(PROFILE_ICONS.map((i) => i.id)).toEqual([...PROFILE_ICON_IDS]);
    expect(PROFILE_COLORS.map((c) => c.id)).toEqual([...PROFILE_COLOR_IDS]);
    expect(PROFILE_ICONS.map((i) => i.label)).toEqual(["집", "열쇠", "이삿짐", "학사모", "지갑", "지킴이 집"]);
    expect(PROFILE_COLORS.map((c) => c.label)).toEqual(["파랑", "민트", "복숭아", "레몬", "라벤더", "하늘"]);
    expect(DEFAULT_PROFILE_CARD).toEqual({ icon: "rent", color: "blue", name: null, pinnedBadge: null });
    expect(PROFILE_COLORS[0]).toMatchObject({ strong: "#d6e6ff", tint: "#eaf2ff" });
  });
});
