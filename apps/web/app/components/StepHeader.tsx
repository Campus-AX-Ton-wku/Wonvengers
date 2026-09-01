"use client";

import { ICON_SM, Pencil } from "./icons";

/**
 * 질문 그 자체가 화면 제목이다. 번호도 이모지도 붙이지 않는다.
 *
 * 제목의 줄바꿈(\n)을 그대로 살린다. 자동 줄바꿈에 맡기면 "생년월일이 어떻게 /
 * 되시나요?" 처럼 어절 중간에서 끊긴다. 두 줄짜리 질문은 의미 단위로 끊어야 읽힌다.
 *
 * leading-tight(1.25)은 26px 한글에서 윗선이 잘린다. 한글은 라틴보다 글자틀이 크고
 * 받침이 아래로 내려가므로 1.35 는 있어야 두 줄이 안 붙는다.
 */
export function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="whitespace-pre-line text-[26px] font-extrabold leading-[1.35] tracking-tight text-ink-900">
        {title}
      </h1>
      {description && <p className="text-sm leading-relaxed text-ink-600">{description}</p>}
    </div>
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
 * 1층 4단계 + 계약 2단계 + 2층 N단계를 합치면 열 단계가 넘는데, 그 숫자를 '3/11' 로
 * 먼저 보여주면 시작하기도 전에 질린다. 대신 답한 질문이 아래로 쌓이게 해서,
 * 얼마나 왔는지를 남은 분량이 아니라 해낸 분량으로 말한다.
 * (docs/기획/2026-08-30-화면-구조-개편-설계.md)
 *
 * 각 줄은 눌러서 그 질문으로 돌아갈 수 있다. 연필 아이콘이 그 사실을 말한다 —
 * 예전에는 눌러도 된다는 표시가 아무것도 없었다.
 */
export function AnsweredStack({ items }: { items: AnsweredItem[] }) {
  const answered = items.filter((it) => it.value !== null);
  if (answered.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-ink-200 pt-2">
      {answered.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onEdit}
          aria-label={`${it.label} 고치기`}
          className="focus-ring group -mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-brand-50"
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-ink-500">{it.label}</span>
            <span className="block text-base font-bold text-ink-900">{it.value}</span>
          </span>
          <Pencil
            size={ICON_SM}
            aria-hidden="true"
            className="shrink-0 text-ink-300 transition-colors group-hover:text-brand-700"
          />
        </button>
      ))}
    </div>
  );
}
