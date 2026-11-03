"use client";

import { useRouter } from "next/navigation";

export interface SummaryItem {
  key: string;
  /** 무엇에 대한 답인지. 화면에는 안 쓰고 aria-label 에만 쓴다. */
  label: string;
  value: string;
  /** 그 단계 주소. 누르면 그리로 간다. */
  href: string;
}

/**
 * 고른 답을 상단바 바로 아래 한 줄로 고정해 보여준다.
 *
 * 예전에는 답한 것이 현재 질문 아래로 쌓였고(AnsweredStack), 시군구·소득처럼 목록이 긴
 * 단계에서는 화면 밖으로 밀려 보이지 않았다 — 2026-10-23 멘토링 지적
 * (docs/기획/2026-11-03-단계-이동-설계.md).
 *
 * 값만 · 로 잇는다. 한 줄을 넘으면 줄바꿈하지 않고 가로로 스크롤한다 — 두 줄이 되면
 * 질문 제목을 밀어낸다. 항목은 링크라 누르면 그 단계로 가고, 그 이동도 기록에 남아
 * 뒤로가기로 돌아올 수 있다. Next Link 대신 router.push 를 쓰는 이유는 단계 화면들이
 * 이미 router 로 움직이고(테스트 대역도 그것만 따른다), 이 줄은 같은 페이지 안의 이동이라서다.
 *
 * lead 는 왼쪽 앞의 고정 자리다 — /eligibility 의 진행 표시("2/3 가구 · 소득").
 * 항목도 lead 도 없으면 아무것도 그리지 않는다.
 *
 * 상단바(TopBar)는 h-14 + safe-area 높이로 sticky top-0 이다. 이 줄은 그 바로 아래에
 * 붙고 z 는 상단바보다 낮다.
 */
export function AnswerSummaryBar({
  items,
  lead,
}: {
  items: SummaryItem[];
  lead?: React.ReactNode;
}) {
  const router = useRouter();
  if (items.length === 0 && !lead) return null;

  return (
    <nav
      aria-label="고른 답"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 flex items-center gap-2 bg-canvas px-4 min-[390px]:-mx-5 min-[390px]:px-5"
    >
      {lead && <div className="shrink-0">{lead}</div>}
      {lead && items.length > 0 && <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ink-200" />}
      {items.length > 0 && (
        <ol className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap">
          {items.map((item, i) => (
            <li key={item.key} className="flex shrink-0 items-center">
              {i > 0 && (
                <span aria-hidden="true" className="px-0.5 text-ink-300">
                  ·
                </span>
              )}
              <a
                href={item.href}
                aria-label={`${item.label} 고치기: ${item.value}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                }}
                className="focus-ring inline-flex min-h-11 items-center rounded-control px-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800"
              >
                {item.value}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
