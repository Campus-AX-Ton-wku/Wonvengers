"use client";

import { useEffect } from "react";
import type { BenefitResultState } from "@/lib/benefit-result";
import { PerkyCharacter } from "@/app/components";

/**
 * 결과 화면 앞 '찾았어요' 한 장 (11/23 시안 '찾았어요 · 페이드', 설계 노트 '찾았어요 화면 설계').
 *
 * 선물 상자를 건네며 "3개 들었어!" 하고 먼저 말해 주는 한마디. 파란 화면에서 Perky 가 튀어나오고
 * 숫자가 0부터 굴러 올라간 뒤, 버튼 없이 저절로 결과 화면으로 넘어간다 — 위로 걷히지 않고 옅어지듯.
 *
 * 시간표 (시안의 4초 반복을 한 번짜리로 옮겼다 — 키프레임은 globals.css 'reveal-*'):
 *   0.08초 Perky 튀어나옴 · 0.24초 첫 줄 · 0.32~1.08초 숫자 굴림 · 0.88초 둘째 줄
 *   2.2초 글자가 옅어지며 살짝 위로 → 2.28초 파랑이 걷힘 → 2.4초 결과 화면이 아래에서 떠오름 → 2.8초 끝
 * 동작 줄이기: 굴림 · 튀어 오름 없이 다 나온 모습으로 1.5초, 옅어지기 없이 바로 넘어간다.
 *
 * 숫자 = 결과 화면의 지원 카드 수(합계에 넣은 지원 + 조건이 맞으면 더 받을 수 있는 지원 전부).
 * 지원 이름 · 금액은 넣지 않는다 — 이름은 다음 화면 카드가, 금액은 영수증이 말한다. 여기서 합계를
 * 보이면 합계 밖 지원까지 더한 돈처럼 읽힐 수 있다.
 */

/** 둘째 줄 — 결과 제목과 같은 기준(맨 위 카드 상태) */
const SECOND_LINE: Record<BenefitResultState, string> = {
  eligible: "지금 바로 신청할 수 있어요",
  check: "조건을 확인하면 받을 수 있어요",
  urgent: "마감이 가까운 혜택이 있어요",
};

/** 결과 화면을 깔기 시작하는 때 · 막을 걷는 때 (ms) */
export const REVEAL_TIMING = {
  motion: { leave: 2400, done: 2800 },
  reduced: { leave: 1500, done: 1500 },
} as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export default function FoundReveal({
  count,
  leadState,
  onLeave,
  onDone,
}: {
  count: number;
  leadState: BenefitResultState;
  /** 파랑이 걷히기 시작할 때 — 결과 화면을 밑에 깐다 */
  onLeave: () => void;
  /** 막이 다 걷혔을 때 */
  onDone: () => void;
}) {
  useEffect(() => {
    const timing = prefersReducedMotion() ? REVEAL_TIMING.reduced : REVEAL_TIMING.motion;
    const leave = window.setTimeout(onLeave, timing.leave);
    const done = window.setTimeout(onDone, timing.done);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
    // 한 번만 — 부모가 다시 그려져도 시간표를 새로 잡지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const digits = Array.from({ length: count + 1 }, (_, i) => i);

  return (
    <div className="reveal fixed inset-0 z-[60]" role="status">
      {/* 화면 읽기는 한 문장으로 한 번 — 굴러가는 숫자 기둥(0 1 2 3)을 읽지 않게 눈에 보이는 것은 숨긴다 */}
      <span className="sr-only">받을 수 있는 혜택 {count}가지를 찾았어요</span>
      {/* 로딩 화면과 같은 Perky 블루. 다크 모드에서도 같은 파랑이다(흰 글씨 대비 유지) */}
      <div
        aria-hidden="true"
        className="reveal-panel absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 60% at 50% 42%, #3f86f7 0%, rgba(63,134,247,0) 62%), linear-gradient(180deg, #1a6bef 0%, #1257d1 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="reveal-stage absolute inset-0 flex flex-col items-center justify-center px-6 pb-[72px] text-center text-white"
      >
        <div
          className="reveal-mascot flex size-[164px] items-center justify-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 62%, rgba(255,255,255,0) 72%)",
          }}
        >
          <PerkyCharacter state="found" size={136} priority className="size-[136px]" />
        </div>
        <p className="reveal-l1 mt-1.5 text-lg font-bold leading-[1.4]">
          <span className="opacity-[0.86]">받을 수 있는 혜택을</span>
        </p>
        <p className="reveal-l1 mt-0.5 flex items-baseline justify-center gap-0.5 font-extrabold tracking-[-0.02em]">
          <span className="reveal-num inline-block h-[1em] overflow-hidden text-[64px] leading-[1em] tabular-nums">
            <span
              className="reveal-digits block"
              style={{ "--reveal-n": count } as React.CSSProperties}
              data-testid="reveal-digits"
            >
              {digits.map((n) => (
                <span key={n} className="block h-[1em] leading-[1em]">
                  {n}
                </span>
              ))}
            </span>
          </span>
          <span className="text-[30px] leading-[1.3]">가지 찾았어요</span>
        </p>
        <p className="reveal-l2 mt-1.5 text-[15px] leading-normal text-white/[0.82]">{SECOND_LINE[leadState]}</p>
      </div>
    </div>
  );
}
