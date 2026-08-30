"use client";

import Link from "next/link";

/**
 * 모바일 앱 형태의 스텝 골격. 상단 앱바(뒤로가기) / 하단 고정 CTA / 세로 선택 버튼 /
 * 답한 질문이 쌓이는 영역.
 *
 * 진행률 표시는 없다. 1층 4단계 + 계약 2단계 + 2층 N단계를 합치면 열 단계가 넘는데,
 * 그 숫자를 '3/11' 로 먼저 보여주면 시작하기도 전에 질린다. 대신 답한 질문이 화면
 * 아래로 쌓이게 해서, 얼마나 왔는지를 남은 분량이 아니라 해낸 분량으로 말한다.
 * (docs/기획/2026-08-30-화면-구조-개편-설계.md)
 */

/* 상호작용 상태를 한 곳에 모은다. 이전에는 active: 만 있어서 키보드 사용자에게는
   포커스 표시가 브라우저 기본값뿐이었고, 데스크톱에서는 hover 반응이 아예 없었다. */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

/**
 * 앱바 가운데 브랜드. 내부 화면에서 홈으로 돌아갈 유일한 통로다.
 *
 * text-sm(14px)은 h-14 앱바 안에서 너무 작아 브랜드로 읽히지 않았다. 양옆 48px
 * 터치 타깃 사이 공간이 넉넉해서 20px 까지는 줄바꿈·겹침 없이 들어간다.
 */
export function HomeMark() {
  return (
    <Link
      href="/"
      className={`rounded px-2 py-1 text-xl font-extrabold tracking-tight text-ink-900 transition-colors hover:text-brand-700 ${FOCUS_RING}`}
    >
      Perky
    </Link>
  );
}

function BackArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 19L8 12l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 뒤로가기 + 브랜드만 있는 앱바. 모든 스텝 화면과 결과 화면이 같은 것을 쓴다.
 *
 * 오른쪽 자리는 비워 둔 채 폭을 잡는다. 그래야 가운데 브랜드가 화면 중앙에 온다.
 */
export function AppBar({
  onBack,
  backLabel = "이전 단계로",
}: {
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-100 active:bg-ink-100 ${FOCUS_RING}`}
        >
          <BackArrow />
        </button>
        <HomeMark />
        <span className="w-12" aria-hidden="true" />
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

/**
 * 세로로 쌓이는 선택 버튼. 가로 3분할보다 터치 타깃이 크다.
 *
 * 비선택 상태에 테두리를 두르지 않는다. 선택지 넷에 전부 테두리가 있으면 아직
 * 아무것도 고르지 않았는데도 화면이 상자로 가득 찬다. 옅은 면으로 눌리는 자리만
 * 알려주고, 색은 실제로 고른 것에만 쓴다. 테두리 대신 ring 을 쓰는 이유는 두
 * 상태의 높이가 1px 도 어긋나면 안 되기 때문이다.
 */
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
      className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-base font-semibold transition-colors ${FOCUS_RING} ${
        active
          ? "bg-brand-50 text-brand-900 ring-2 ring-inset ring-brand-600"
          : "bg-sand-50 text-ink-700 hover:bg-brand-50"
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

/**
 * 질문 그 자체가 화면 제목이다. 번호도 이모지도 붙이지 않는다.
 *
 * 제목의 줄바꿈(\n)을 그대로 살린다. 자동 줄바꿈에 맡기면 "생년월일이 어떻게 /
 * 되시나요?" 처럼 어절 중간에서 끊긴다. 두 줄짜리 질문은 의미 단위로 끊어야 읽힌다.
 */
export function StepHeading({ title }: { title: string }) {
  return (
    /* leading-tight(1.25)은 26px 한글에서 윗선이 잘린다. 한글은 라틴보다 글자틀이
       크고 받침이 아래로 내려가므로 1.35 는 있어야 두 줄이 안 붙는다. */
    <h1 className="whitespace-pre-line text-[26px] font-extrabold leading-[1.35] tracking-tight text-ink-900">
      {title}
    </h1>
  );
}

export interface AnsweredItem {
  label: string;
  /** 아직 답하지 않았으면 null. 그 항목은 쌓지 않는다. */
  value: string | null;
  /** 그 질문으로 돌아간다. */
  onEdit: () => void;
}

/**
 * 답한 질문이 쌓이는 영역. 진행률 표시를 대신한다.
 *
 * 각 줄은 눌러서 그 질문으로 돌아갈 수 있다. 목록 화면의 '답변 고치기' 가 마지막
 * 단계로 보내면, 거기 쌓인 네 줄이 곧 답변 요약이자 수정 진입점이 된다 — 요약
 * 화면을 따로 만들지 않아도 된다.
 */
export function AnsweredStack({ items }: { items: AnsweredItem[] }) {
  const answered = items.filter((it) => it.value !== null);
  if (answered.length === 0) return null;

  return (
    <div className="mt-2 border-t border-sand-200">
      {answered.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onEdit}
          aria-label={`${it.label} 고치기`}
          className={`-mx-2 flex w-[calc(100%+1rem)] flex-col items-start gap-0.5 rounded-xl px-2 py-3 text-left transition-colors hover:bg-sand-50 ${FOCUS_RING}`}
        >
          <span className="text-xs font-semibold text-ink-500">{it.label}</span>
          <span className="text-base font-bold text-ink-900">{it.value}</span>
        </button>
      ))}
    </div>
  );
}
