import Link from "next/link";

const WORDMARK_SRC = "/brand/perky-wordmark-primary.svg";

/**
 * Figma Primary 워드마크(64:26).
 *
 * 텍스트와 잎을 코드로 조합하면 글꼴 렌더링마다 비율이 달라진다. 랜딩과 상단 바가
 * 내려받은 동일 원본 SVG를 사용해 브랜드 비율을 유지한다.
 */

export function Wordmark({
  size = "sm",
  className = "",
}: {
  /** sm — 상단 바. lg — 랜딩·온보딩의 브랜드 한 번. */
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <img
      src={WORDMARK_SRC}
      alt="Perky"
      width={size === "lg" ? 122 : 52}
      height={size === "lg" ? 56 : 24}
      className={`block w-auto object-contain ${size === "lg" ? "h-14" : "h-6"} ${className}`}
    />
  );
}

/**
 * 상단 바 가운데의 브랜드. 내부 화면에서 홈으로 돌아갈 유일한 통로다.
 *
 * 44px 터치 타깃 안에 Figma 원본 워드마크를 배치한다.
 */
export function HomeMark() {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex min-h-11 items-center rounded-lg px-2 py-1 transition-opacity hover:opacity-70"
    >
      <Wordmark />
    </Link>
  );
}
