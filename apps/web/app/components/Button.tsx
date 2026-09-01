import Link from "next/link";

/**
 * 앱의 유일한 버튼.
 *
 * 예전에는 화면마다 `rounded-xl bg-brand-600 py-4 …` 를 손으로 다시 썼다. 그래서
 * 랜딩 CTA 는 text-lg, 스텝 CTA 는 text-base, 결과의 '답변 수정하기' 는 border 만
 * 있는 식으로 조금씩 어긋났다. 여기 세 변주만 둔다.
 *
 *   primary   — 화면당 하나. 다음으로 나아가는 동작.
 *   secondary — primary 옆에 서는 대안. 면은 옅은 파랑, 글씨는 진한 파랑.
 *   quiet     — 되돌아가기·고치기처럼 흐름을 벗어나는 동작. 테두리만.
 *
 * 크기는 lg(56px)와 md(44px) 둘뿐이다. 둘 다 손가락이 닿는 44px 이상이다.
 */

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "lg" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none",
  secondary:
    "bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:bg-ink-100 disabled:text-ink-500",
  quiet:
    "border border-ink-200 bg-surface text-ink-600 hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-300",
};

const SIZE: Record<ButtonSize, string> = {
  lg: "min-h-14 px-6 py-4 text-base",
  md: "min-h-11 px-4 py-2.5 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "lg",
  full = true,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
} = {}) {
  return [
    // active:scale 은 눌린 순간의 손맛이다. 0.99 보다 깊게 주면 카드가 흔들려 보인다.
    "focus-ring inline-flex items-center justify-center gap-2 rounded-control font-bold leading-tight transition-[background-color,border-color,transform] active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANT[variant],
    SIZE[size],
    full ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: SharedProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={buttonClass({ variant, size, full, className })} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: SharedProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass({ variant, size, full, className })} {...rest}>
      {children}
    </Link>
  );
}
