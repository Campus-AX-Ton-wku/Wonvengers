"use client";

import Link from "next/link";

/**
 * 모바일 앱 형태의 스텝 골격. 상단 앱바(뒤로가기 + 진행률) / 하단 고정 CTA /
 * 세로 선택 카드. docs/디자인/reference 의 토스·삼쩜삼 온보딩 화면 구조를 따른다.
 */

/* 상호작용 상태를 한 곳에 모은다. 이전에는 active: 만 있어서 키보드 사용자에게는
   포커스 표시가 브라우저 기본값뿐이었고, 데스크톱에서는 hover 반응이 아예 없었다. */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

/** 앱바 가운데 브랜드. 내부 화면에서 홈으로 돌아갈 유일한 통로다. */
export function HomeMark() {
  return (
    <Link
      href="/"
      className={`rounded px-2 py-1 text-sm font-extrabold tracking-tight text-ink-900 transition-colors hover:text-brand-700 ${FOCUS_RING}`}
    >
      Perky
    </Link>
  );
}

export function AppBar({
  onBack,
  current,
  total,
}: {
  onBack: () => void;
  current: number;
  total: number;
}) {
  const percent = Math.round((current / total) * 100);
  return (
    <header className="sticky top-0 z-10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 단계로"
          className={`flex h-12 w-12 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-100 active:bg-ink-100 ${FOCUS_RING}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 19L8 12l7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <HomeMark />
        <span className="w-12 pr-2 text-right text-sm font-semibold text-ink-500">
          {current}/{total}
        </span>
      </div>
      <div
        className="h-[3px] bg-ink-100"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="진행률"
      >
        <div
          className="h-full bg-brand-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </header>
  );
}

/** 화면 하단에 붙어 스크롤과 무관하게 항상 손이 닿는 위치를 유지한다. */
export function BottomCta({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-auto bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-xl bg-brand-600 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.99] active:bg-brand-700 ${FOCUS_RING}`}
      >
        {children}
      </button>
    </div>
  );
}

/** 세로로 쌓이는 선택 카드. 가로 3분할보다 터치 타깃이 크다. */
export function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-base font-semibold transition-colors ${FOCUS_RING} ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-900"
          : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50"
      }`}
    >
      <span>{children}</span>
      {active && (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="10" fill="currentColor" />
          <path
            d="M6 10.5l2.5 2.5L14 7.5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-extrabold leading-snug text-ink-900">{title}</h1>
      {description && <p className="text-sm leading-relaxed text-ink-500">{description}</p>}
    </div>
  );
}

/** 진행률이 없는 화면(결과)용 앱바. */
export function ResultAppBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 화면으로"
          className={`flex h-12 w-12 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-100 active:bg-ink-100 ${FOCUS_RING}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 19L8 12l7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <HomeMark />
        <span className="w-12" aria-hidden="true" />
      </div>
    </header>
  );
}
