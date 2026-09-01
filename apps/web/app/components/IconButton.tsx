import Link from "next/link";

/**
 * 아이콘만 있는 버튼. `label` 이 필수인 이유가 이 컴포넌트의 존재 이유다 —
 * 아이콘 버튼은 접근 가능한 이름을 빠뜨리기 가장 쉬운 자리다.
 *
 * 44px 은 손가락이 닿는 최소 크기다(iOS HIG · WCAG 2.5.8). 아이콘 자체는 20~24px
 * 이고 나머지는 여백으로 채운다 — 아이콘을 키우는 게 아니라 타깃을 키운다.
 */
const BASE =
  "focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-ink-100 active:bg-ink-200";

export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} className={`${BASE} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconLink({
  href,
  label,
  children,
  className = "",
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={label} className={`${BASE} ${className}`}>
      {children}
    </Link>
  );
}
