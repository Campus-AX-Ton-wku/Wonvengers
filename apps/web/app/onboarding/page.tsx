"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Button, PerkyCharacter, StickyBottomAction } from "@/app/components";
import type { PerkyState } from "@/app/components";
import { markOnboardingSeen } from "@/lib/storage";

/**
 * 앱 시작 시 보여주는 3장짜리 소개.
 *
 * ── 왜 이 화면이 필요한가 ────────────────────────────────────────────
 * 이 앱은 반복 사용자가 없다. 방을 알아보는 중에, 모바일에서, 처음이자 아마도
 * 유일하게 들어온다(PRODUCT.md). 그런 사람에게 랜딩의 CTA 하나만 주면 "질문에
 * 답하면 뭐가 나오는지" 를 모른 채 눌러야 한다. 세 장이 그 답을 미리 준다 —
 * 찾아주고(발견), 물어보고(안내), 금액을 보여준다(결과).
 *
 * ── 노출 규칙 ────────────────────────────────────────────────────
 * 자동 노출은 app/layout.tsx 의 인라인 스크립트가 한다. `/` 로 들어오면
 * 여기로 온다. 이 화면 자체는 언제든 직접 열 수 있다 — 그게 개발·QA 의 재확인
 * 경로이고, 랜딩 하단의 '앱 소개 다시 보기' 링크가 같은 곳을 가리킨다.
 *
 * 마지막 단계 완료 시에만 온보딩 완료를 저장한다.
 *
 * ── SSR ──────────────────────────────────────────────────────────
 * 렌더에 localStorage 를 읽지 않는다. 읽으면 서버 HTML 과 첫 클라이언트 렌더가
 * 달라져 hydration 이 어긋난다. 저장은 사용자가 버튼을 누른 뒤에만 한다.
 */

type Slide = {
  character: PerkyState;
  /** 배경 광원의 색. 단계의 의미와 같은 색을 쓴다 — 결과 단계만 금색이다. */
  glow: string;
  eyebrowSr: string;
  title: string;
  description: string;
};

/* 제목의 줄바꿈은 직접 끊는다. 자동 줄바꿈은 "흩어진 청년 / 혜택을" 처럼
   의미 단위를 무시한다. */
const SLIDES: Slide[] = [
  {
    character: "search",
    glow: "bg-brand-200",
    eyebrowSr: "발견",
    title: "흩어진 청년 혜택을\n한곳에서 찾아드려요",
    description:
      "국가·지자체에 나뉘어 있는 주거 지원금을 한 목록으로 모아 둡니다.",
  },
  {
    character: "guide",
    glow: "bg-brand-200",
    eyebrowSr: "안내",
    title: "몇 가지 질문으로\n나에게 맞는 혜택을 안내해요",
    description:
      "생년월일·사는 곳·현재 상태·소득 구간 네 가지만 답하면 됩니다. 답변은 이 브라우저에만 저장돼요.",
  },
  {
    character: "success",
    glow: "bg-accent-100",
    eyebrowSr: "결과",
    title: "받을 수 있는 지원과\n실제 부담을 한눈에 확인해요",
    description:
      "최대 얼마를 받을 수 있고, 그러면 실제로 얼마를 내게 되는지까지 계산해 드립니다.",
  },
];

const LAST = SLIDES.length - 1;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  /**
   * 단계가 바뀌면 제목으로 포커스를 옮긴다. 옮기지 않으면 '다음' 버튼에 포커스가
   * 남아 스크린리더 사용자에게는 화면이 바뀐 사실이 들리지 않는다.
   * 첫 렌더에서는 옮기지 않는다 — 페이지에 들어오자마자 포커스가 튀면 안 된다.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function leave(to: string) {
    markOnboardingSeen();
    // replace — 뒤로가기로 온보딩에 되돌아오면 방금 끝낸 화면을 다시 보게 된다.
    router.replace(to);
  }

  const slide = SLIDES[step];
  const isLast = step === LAST;

  return (
    <AppShell>
      {/*
        한 장을 통째로 갈아 끼운다. key 가 바뀌면 slide-in 이 다시 돈다 —
        캐릭터가 먼저 자리를 잡고 글이 따라 온다.

        aria-live 는 쓰지 않는다. 제목으로 포커스를 옮기므로(위 useEffect) 같은
        내용을 두 번 읽게 된다.
      */}
      <main key={step} className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
        <div className="relative flex items-center justify-center">
          {/* 배경 광원. 캐릭터 뒤 한 겹뿐이고 단계마다 색이 바뀐다.
              blur-3xl 로 형태를 지운다 — 원으로 읽히면 장식이 된다. */}
          <span
            aria-hidden="true"
            className={`slide-in absolute h-[76%] w-[76%] rounded-full opacity-70 blur-3xl ${slide.glow}`}
          />
          <PerkyCharacter
            state={slide.character}
            size={520}
            priority={step === 0}
            className="slide-in relative h-auto w-[min(58vw,240px)]"
          />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="slide-in whitespace-pre-line text-[28px] font-extrabold leading-[1.35] tracking-tight text-ink-900 outline-none"
            style={{ animationDelay: "0.06s" }}
          >
            {/* 단계 이름은 화면에 적지 않는다 — 제목이 이미 같은 말을 한다.
                스크린리더에는 남겨서 "3단계 중 1단계, 발견" 으로 들리게 한다. */}
            <span className="sr-only">
              {SLIDES.length}단계 중 {step + 1}단계 · {slide.eyebrowSr}.{" "}
            </span>
            {slide.title}
          </h1>
          <p
            className="slide-in max-w-[19rem] text-[15px] leading-relaxed text-ink-600"
            style={{ animationDelay: "0.12s" }}
          >
            {slide.description}
          </p>
        </div>
      </main>

      <StickyBottomAction>
        {/* 진행 점. 눌러서 그 장으로 갈 수 있다 — 점만 그려 두고 못 누르게 하면
            어디까지 왔는지는 알려주면서 되돌아갈 길은 막는 셈이다. */}
        <div className="mb-4 flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.character}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`${i + 1}단계 · ${s.eyebrowSr}`}
              aria-current={i === step ? "step" : undefined}
              className="focus-ring flex h-11 w-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className={`block h-2 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-brand-600" : "w-2 bg-ink-200"
                }`}
              />
            </button>
          ))}
        </div>

        <Button onClick={() => (isLast ? leave("/find") : setStep(step + 1))}>
          {isLast ? "내 혜택 찾아보기" : "다음"}
        </Button>

        {/* '이전' 은 자리를 늘 잡아 둔다. 1장에서만 사라지면 버튼이 그 순간 위로
            튀어 올라 '다음' 의 위치가 바뀐다. */}
        <div className="flex h-11 items-center justify-center">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="focus-ring rounded-control px-4 py-2 text-sm font-bold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              이전
            </button>
          )}
        </div>
      </StickyBottomAction>
    </AppShell>
  );
}
