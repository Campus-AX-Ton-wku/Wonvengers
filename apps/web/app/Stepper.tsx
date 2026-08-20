"use client";

/**
 * 모바일 앱 형태의 스텝 골격. 상단 앱바(뒤로가기 + 진행률) / 하단 고정 CTA /
 * 세로 선택 카드. docs/디자인/reference 의 토스·삼쩜삼 온보딩 화면 구조를 따른다.
 */

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
          className="flex h-12 w-12 items-center justify-center rounded-full text-ink-900 active:bg-ink-100"
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
        <span className="px-4 text-sm font-semibold text-ink-500">
          {current} / {total}
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
        className="w-full rounded-xl bg-brand-600 py-4 text-base font-bold text-white active:scale-[0.99]"
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
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-base font-semibold transition-colors ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-900"
          : "border-ink-200 bg-white text-ink-700"
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
      <div className="flex h-14 items-center px-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 화면으로"
          className="flex h-12 w-12 items-center justify-center rounded-full text-ink-900 active:bg-ink-100"
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
      </div>
    </header>
  );
}
