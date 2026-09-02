import Link from "next/link";

/**
 * Perky 워드마크.
 *
 * 캐릭터 머리의 새싹 두 잎을 'P' 위에 얹는다 — 앱 아이콘 시안과 같은 장치라,
 * 홈 화면 아이콘과 화면 속 로고가 같은 물건으로 읽힌다. 잎은 장식이므로
 * aria-hidden 이고, 접근성 이름은 글자 'Perky' 가 갖는다.
 *
 * 잎을 인라인 SVG 로 두는 이유: 글자 크기가 바뀌면 잎도 함께 커져야 하는데
 * (em 단위), 이미지로 두면 크기마다 파일이 필요하다.
 */
function Sprout({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      focusable="false"
    >
      {/* 왼쪽으로 눕는 잎 · 오른쪽으로 서는 잎. 캐릭터 머리깃과 같은 방향이다. */}
      <path d="M11.2 15.4c-.6-4.2-3.1-7-7.4-8.3-1.5-.5-2.6.6-2 2 1.6 3.9 4.7 6 9.4 6.3z" />
      <path d="M13.2 15.4c.2-5 2.5-8.6 6.9-10.9 1.4-.7 2.6.3 2.2 1.8-1.2 5-4.2 8-9.1 9.1z" />
    </svg>
  );
}

export function Wordmark({
  size = "sm",
  className = "",
}: {
  /** sm — 상단 바. lg — 랜딩·온보딩의 브랜드 한 번. */
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block font-extrabold tracking-tight text-ink-900 ${
        size === "lg" ? "text-5xl" : "text-xl"
      } ${className}`}
    >
      <Sprout
        aria-hidden="true"
        className="absolute left-[0.06em] top-[-0.42em] h-[0.34em] w-[0.5em] text-brand-600"
      />
      Perky
    </span>
  );
}

/**
 * 상단 바 가운데의 브랜드. 내부 화면에서 홈으로 돌아갈 유일한 통로다.
 *
 * text-sm(14px)은 h-14 앱바 안에서 너무 작아 브랜드로 읽히지 않았다. 양옆 48px
 * 터치 타깃 사이 공간이 넉넉해서 20px 까지는 줄바꿈·겹침 없이 들어간다.
 */
export function HomeMark() {
  return (
    <Link
      href="/"
      className="focus-ring rounded-lg px-2 py-1 transition-opacity hover:opacity-70"
    >
      <Wordmark />
    </Link>
  );
}
