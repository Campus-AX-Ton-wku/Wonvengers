import type { CSSProperties } from "react";
import { DEFAULT_PROFILE_CARD, profileColor, profileIcon } from "@/lib/profile-card";
import type { ProfileCardData } from "@/lib/user-data";
import { BadgeMedal } from "./BadgeMedal";
import { Icon3D } from "./Icon3D";

/**
 * 프로필 그림 동그라미 (docs/기획/2026-11-22-내-프로필-설계.md §2) — 고른 색 위에 고른 3D 그림.
 * 홈 인사(sm 36px)와 내 정보 프로필 카드(lg 96px)가 같이 쓴다. 안 꾸몄으면 집 · 파랑.
 * 뜻은 옆 이름이 말한다 — 그림은 aria-hidden. 어두운 화면에서는 같은 색을 반투명으로(lib/profile-card.ts).
 */
export function ProfileAvatar({
  card,
  size,
  children,
}: {
  card: ProfileCardData | null;
  size: "sm" | "lg";
  /** 동그라미 오른쪽 아래에 붙일 것(② 대표 배지) */
  children?: React.ReactNode;
}) {
  const c = card ?? DEFAULT_PROFILE_CARD;
  const color = profileColor(c.color);
  const icon = profileIcon(c.icon);
  const style = { "--avatar": color.strong, "--avatar-dark": color.darkStrong } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-profile-color={c.color}
      style={style}
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-[var(--avatar)] shadow-[inset_0_0_0_2px_var(--color-surface),0_4px_10px_-6px_rgba(11,42,74,0.35)] dark:bg-[var(--avatar-dark)] ${
        size === "lg" ? "size-24" : "size-9"
      }`}
    >
      <Icon3D name={icon.icon} size={size === "lg" ? 64 : 26} />
      {/* 대표 배지 — 오른쪽 아래에 작게(②). 36px 홈 인사 그림에는 너무 작아 붙이지 않는다 */}
      {size === "lg" && c.pinnedBadge && (
        <span className="absolute -bottom-0.5 -right-0.5">
          <BadgeMedal id={c.pinnedBadge} size="pin" />
        </span>
      )}
      {children}
    </span>
  );
}
