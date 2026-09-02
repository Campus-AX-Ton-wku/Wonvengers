import Image from "next/image";

/**
 * 마스코트 Perky. 여덟 포즈 중 하나를 그린다.
 *
 * ── 쓰는 규칙 (docs/디자인/design-tokens.md) ──────────────────────
 * · **상태를 말하는 자리에만.** 장식으로 놓지 않는다.
 * · **한 화면에 한 포즈.** 둘 이상이면 어느 것이 지금 상태인지 알 수 없다.
 * · **비율을 유지한다.** 원본은 1254×1254 정사각이다. crop·왜곡 금지.
 *   반응형 크기는 className 으로 준다 — `w-[min(58vw,240px)] h-auto`.
 * · `alt=""` + `aria-hidden` 이다. 상태는 언제나 옆의 글자가 말한다.
 *   캐릭터가 그것을 대신하지 않는다.
 *
 * 정적 export 라 이미지 최적화가 없다(next.config.ts). srcset 이 생기지 않으므로
 * `sizes` 를 주지 않는다 — 주면 지켜지지 않는 약속을 마크업에 남기는 셈이다.
 * width/height 는 브라우저가 자리를 미리 잡게 하는 용도이고, 실제 크기는
 * className 이 정한다.
 */

export const PERKY_STATES = [
  "basic",
  "search",
  "found",
  "guide",
  "success",
  "empty",
  "thinking",
  "wave",
] as const;

export type PerkyState = (typeof PERKY_STATES)[number];

const CHARACTER_ASSETS: Record<PerkyState, string> = {
  basic: "/characters/perky/perky-basic.webp",
  search: "/characters/perky/perky-search.webp",
  found: "/characters/perky/perky-found.webp",
  guide: "/characters/perky/perky-guide.webp",
  success: "/characters/perky/perky-success.webp",
  empty: "/characters/perky/perky-empty.webp",
  thinking: "/characters/perky/perky-thinking.webp",
  wave: "/characters/perky/perky-wave.webp",
};

type PerkyCharacterProps = {
  state?: PerkyState;
  /** 레이아웃 자리를 잡을 기준 크기(px). 실제 크기는 className 이 이긴다. */
  size?: number;
  priority?: boolean;
  className?: string;
};

export default function PerkyCharacter({
  state = "basic",
  size = 160,
  priority = false,
  className,
}: PerkyCharacterProps) {
  return (
    <Image
      src={CHARACTER_ASSETS[state]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
