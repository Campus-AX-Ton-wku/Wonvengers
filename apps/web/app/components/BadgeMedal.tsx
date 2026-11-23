import { badgeOf } from "@/lib/badges";
import type { BadgeId } from "@/lib/user-data";
import { Icon3D } from "./Icon3D";

/**
 * 배지 그림 (내 프로필 설계 §7) — 기존 3D 아이콘을 둥근 판 위에. 받은 배지는 색, 아직인 배지는 회색.
 * lg: 받는 순간 창(96px) · md: 내 정보 배지 칸(56px) · pin: 프로필 그림 오른쪽 아래 대표 배지(32px).
 * 뜻은 옆 글자가 말한다 — 그림은 aria-hidden.
 */
export function BadgeMedal({ id, size, earned = true }: { id: BadgeId; size: "lg" | "md" | "pin"; earned?: boolean }) {
  const badge = badgeOf(id);
  const box = size === "lg" ? "size-24" : size === "md" ? "size-14" : "size-8";
  const icon = size === "lg" ? 64 : size === "md" ? 40 : 26;
  return (
    <span
      aria-hidden="true"
      data-badge={id}
      data-earned={earned ? "yes" : "no"}
      className={`flex shrink-0 items-center justify-center rounded-full ${box} ${
        earned ? "bg-brand-50" : "bg-ink-100"
      } ${size === "pin" ? "shadow-[0_0_0_2px_var(--color-surface),0_2px_6px_-2px_rgba(11,42,74,0.35)]" : ""}`}
    >
      <Icon3D name={badge.icon} size={icon} className={earned ? "" : "opacity-45 grayscale"} />
    </span>
  );
}
