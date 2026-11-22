const WORDMARK_SRC = "/brand/perky-wordmark-primary.svg";

/**
 * Figma Primary 워드마크(64:26).
 *
 * 텍스트와 잎을 코드로 조합하면 글꼴 렌더링마다 비율이 달라진다. 랜딩과 상단 바가
 * 내려받은 동일 원본 SVG를 사용해 브랜드 비율을 유지한다.
 *
 * 다크 모드에선 globals.css 가 `img.wordmark` 의 그림만 perky-wordmark-dark.svg 로 바꾼다(배경 사각형 없이 글자를 밝게) —
 * img 한 장이라 alt 가 하나로 남는다 (11/22).
 */

export function Wordmark({
  size = "sm",
  className = "",
}: {
  /** lg — 랜딩·온보딩의 브랜드 한 번. sm — 작은 자리용. */
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <img
      src={WORDMARK_SRC}
      alt="Perky"
      width={size === "lg" ? 122 : 52}
      height={size === "lg" ? 56 : 24}
      className={`wordmark block w-auto object-contain ${size === "lg" ? "h-14" : "h-6"} ${className}`}
    />
  );
}
