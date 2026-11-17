import Link from "next/link";

/**
 * 앱의 유일한 버튼.
 *
 * 예전에는 화면마다 `rounded-xl bg-brand-600 py-4 …` 를 손으로 다시 썼다. 그래서
 * 랜딩 CTA 는 text-lg, 스텝 CTA 는 text-base, 결과의 '답변 수정하기' 는 border 만
 * 있는 식으로 조금씩 어긋났다. 여기 다섯 변주만 둔다.
 *
 *   primary   — 화면당 하나. 다음으로 나아가는 동작.
 *   secondary — primary 옆에 서는 대안, 카드 안 보조 동작. 면은 옅은 파랑, 글씨는 진한 파랑.
 *   quiet     — 되돌아가기·고치기처럼 흐름을 벗어나는 동작. 흰 면 + 얇은 테두리.
 *   text      — 시트 안에서 물러서는 동작(취소·로그인 없이 보기). 면도 테두리도 없다.
 *   danger    — 지우는 동작의 확인(회원 탈퇴 · 로그아웃 · 처음부터 다시). 확인 시트 안에서만 쓴다.
 *
 * 크기는 lg(56px), screen(52px), md(44px) 세 단계뿐이며 모두 손가락이 닿는 44px 이상이다.
 * 하단 고정 CTA 는 lg, 카드·시트 안의 큰 버튼은 screen, 줄 안의 보조 버튼은 md 다.
 *
 * ── 재질 (2026-11-17 디자인 시안 '말랑하게 눌리는 버튼') ──
 * Perky 캐릭터처럼 둥글고 폭신하게: 윗면 빛 1px, 아랫면 립 3px(globals.css --shadow-btn-*).
 * 누르면 립이 1px 로 줄고 버튼이 2px 내려앉는다 — 실제로 눌린 것처럼 보인다.
 * 예전에는 0.99 로 살짝 작아지게만 했다(더 깊게 줄이면 카드 전체가 흔들려 보였다). 크기를
 * 바꾸는 대신 아래로 옮기므로 옆 요소와 테두리가 흔들리지 않는다. text 는 립이 없어 내려앉지
 * 않고, 누를 때만 면이 생긴다. 비활성은 립도 내려앉음도 없다.
 */

export type ButtonVariant = "primary" | "secondary" | "quiet" | "text" | "danger";
export type ButtonSize = "lg" | "md" | "screen";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-btn-primary hover:bg-brand-700 active:bg-brand-700 active:shadow-btn-primary-pressed disabled:bg-ink-200 disabled:shadow-none disabled:text-ink-500",
  secondary:
    "bg-brand-50 text-brand-800 shadow-btn-secondary hover:bg-brand-100 active:bg-brand-100 active:shadow-btn-secondary-pressed disabled:bg-ink-100 disabled:shadow-none disabled:text-ink-500",
  quiet:
    "bg-surface text-ink-700 shadow-btn-quiet hover:bg-ink-50 active:bg-ink-50 active:shadow-btn-quiet-pressed disabled:text-ink-300 disabled:shadow-btn-quiet-disabled",
  text: "bg-transparent text-ink-600 hover:bg-ink-50 active:bg-ink-100 active:text-ink-700 disabled:text-ink-300",
  danger:
    "bg-danger-600 text-white shadow-btn-danger hover:bg-danger-700 active:bg-danger-700 active:shadow-btn-danger-pressed disabled:bg-ink-200 disabled:shadow-none disabled:text-ink-500",
};

/** 립이 있는 변주만 눌렸을 때 내려앉는다. */
const SINKS: Record<ButtonVariant, boolean> = { primary: true, secondary: true, quiet: true, text: false, danger: true };

const SIZE: Record<ButtonSize, string> = {
  lg: "min-h-14 px-6 py-4 text-base",
  md: "min-h-11 px-4 py-2.5 text-sm",
  // 결과 예외·신청 흐름의 Figma 계약. 기존 lg(56px)를 바꾸지 않고 52px만 추가한다.
  screen: "min-h-[52px] px-5 py-3.5 text-base",
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
    // 누른 순간에 바로 반응해야 손맛이 난다 — 기본 150ms 보다 짧게.
    "focus-ring inline-flex items-center justify-center gap-2 rounded-control font-bold leading-tight transition-[background-color,box-shadow,translate,color] duration-100 disabled:cursor-not-allowed",
    VARIANT[variant],
    SINKS[variant] ? "active:translate-y-0.5 disabled:active:translate-y-0" : "",
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
