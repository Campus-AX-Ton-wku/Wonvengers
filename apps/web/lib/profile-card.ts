import type { Icon3DName } from "./icons3d";
import { provinceForRegion, regionDisplayName, REGION_HIERARCHY } from "./region";
import type { DiscoveryAnswers, DiscoveryStatus } from "./types";
import {
  MAX_PROFILE_NAME,
  type ProfileCardData,
  type ProfileColorId,
  type ProfileIconId,
} from "./user-data";

/**
 * 내 프로필 화면 규칙 (docs/기획/2026-11-22-내-프로필-설계.md §2, 시안 Profile · ProfileSpec).
 * 저장 형식과 검사는 lib/user-data.ts, 이 기기 사본은 lib/storage.ts 의 loadProfileCard · saveProfileCard.
 * 사진 · 카카오 이름은 쓰지 않는다 — 그림 · 색 · 이름 · 대표 배지만.
 */

/** 그림 6 — 기존 3D 아이콘(새로 그리지 않음). 프로필 그림에 마스코트는 쓰지 않는다 */
export const PROFILE_ICONS: readonly { id: ProfileIconId; icon: Icon3DName; label: string }[] = [
  { id: "rent", icon: "rent", label: "집" },
  { id: "move-in", icon: "move-in", label: "열쇠" },
  { id: "moving", icon: "moving", label: "이삿짐" },
  { id: "student", icon: "student", label: "학사모" },
  { id: "wallet", icon: "wallet", label: "지갑" },
  { id: "guarantee", icon: "guarantee", label: "지킴이 집" },
];

/**
 * 색 6 — 그림 동그라미(strong)와 카드 위쪽 물들임(tint)에만 쓴다. 글자색은 바꾸지 않는다.
 * 레몬 · 하늘 물들임은 시안에 없어 같은 계열로 만들었다. 어두운 화면에서는 같은 색을 반투명으로 겹친다(dark*).
 */
export const PROFILE_COLORS: readonly {
  id: ProfileColorId;
  label: string;
  strong: string;
  tint: string;
  darkStrong: string;
  darkTint: string;
}[] = [
  { id: "blue", label: "파랑", strong: "#d6e6ff", tint: "#eaf2ff", darkStrong: "rgba(110, 160, 255, 0.32)", darkTint: "rgba(110, 160, 255, 0.14)" },
  { id: "mint", label: "민트", strong: "#cdf0df", tint: "#e9f8f1", darkStrong: "rgba(90, 210, 160, 0.30)", darkTint: "rgba(90, 210, 160, 0.13)" },
  { id: "peach", label: "복숭아", strong: "#ffdccb", tint: "#fff1ea", darkStrong: "rgba(255, 160, 120, 0.30)", darkTint: "rgba(255, 160, 120, 0.13)" },
  { id: "lemon", label: "레몬", strong: "#ffeeb0", tint: "#fff8dc", darkStrong: "rgba(255, 215, 90, 0.28)", darkTint: "rgba(255, 215, 90, 0.12)" },
  { id: "lavender", label: "라벤더", strong: "#e3daff", tint: "#f3effe", darkStrong: "rgba(170, 150, 255, 0.32)", darkTint: "rgba(170, 150, 255, 0.14)" },
  { id: "sky", label: "하늘", strong: "#cdeefa", tint: "#eaf7fd", darkStrong: "rgba(100, 200, 240, 0.30)", darkTint: "rgba(100, 200, 240, 0.13)" },
];

/** 한 번도 안 꾸며도 밋밋하지 않게 — 집 · 파랑 · 기본 이름 */
export const DEFAULT_PROFILE_CARD: ProfileCardData = { icon: "rent", color: "blue", name: null, pinnedBadge: null };

export function profileIcon(id: ProfileIconId) {
  return PROFILE_ICONS.find((i) => i.id === id) ?? PROFILE_ICONS[0];
}

export function profileColor(id: ProfileColorId) {
  return PROFILE_COLORS.find((c) => c.id === id) ?? PROFILE_COLORS[0];
}

/** 상태를 사람 부르는 말로 — 재직 → 직장인, 구직 → 구직자 (ggue 11/22) */
const STATUS_NOUN: Record<DiscoveryStatus, string> = { 대학생: "대학생", 재직: "직장인", 구직: "구직자" };

/** "익산시" → "익산". 시 · 도만 고른 값이면 시 · 도 약칭("전북") */
function placeName(region: string): string {
  const province = REGION_HIERARCHY.find((p) => p.name === region) ?? null;
  if (province) return province.chipLabel;
  const shown = regionDisplayName(region);
  const last = shown.split(" ").pop() ?? shown;
  const stripped = last.replace(/(시|군|구)$/, "");
  // '중구'처럼 떼면 한 글자만 남는 이름은 그대로 둔다
  if ([...stripped].length < 2) return provinceForRegion(region) ? last : shown;
  return stripped;
}

/** 내 조건으로 지은 이름 — "익산 사는 대학생" (설계 §2) */
export function defaultProfileName(answers: Pick<DiscoveryAnswers, "region" | "status">): string {
  const place = answers.region ? placeName(answers.region) : null;
  const who = answers.status ? STATUS_NOUN[answers.status] : null;
  if (place) return `${place} 사는 ${who ?? "청년"}`;
  return who ?? "청년";
}

/** 입력한 이름을 저장할 모양으로 — 줄바꿈 · 겹친 빈칸을 한 칸으로, 앞뒤 빈칸 지움, 10자에서 자름, 비면 null(기본 이름) */
export function normalizeProfileName(input: string): string | null {
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();
  const clipped = [...cleaned].slice(0, MAX_PROFILE_NAME).join("").trim();
  return clipped.length > 0 ? clipped : null;
}

/** 화면에 보일 이름. 정한 이름이 없으면 기본 이름(isDefault — "내 조건으로 지은 이름이에요" 안내를 붙인다) */
export function profileName(
  card: ProfileCardData | null,
  answers: Pick<DiscoveryAnswers, "region" | "status">
): { name: string; isDefault: boolean } {
  if (card?.name) return { name: card.name, isDefault: false };
  return { name: defaultProfileName(answers), isDefault: true };
}
