"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Button, KakaoButton, PerkyCharacter, StickyBottomAction } from "@/app/components";
import type { PerkyState } from "@/app/components";
import { hasStoredLogin, isLoginAvailable, signIn } from "@/lib/auth";
import { markOnboardingSeen } from "@/lib/storage";
import { replaceKeepingEntry } from "@/lib/navigation";

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
 * ── 시작 화면 (11/20) ──────────────────────────────────────────────
 * 마지막 장이 앱의 시작 화면이다 — [내 혜택 찾아보기](처음 온 사람 → 질문)와 [카카오로 로그인](회원 → 홈).
 * 파랑이 위다: 로그인 없이 바로 써 보는 게 이 앱의 첫 약속이고, 비회원에게는 계산 · 찜을 누를 때
 * 로그인을 다시 권한다(LoginSheet). 회원은 '처음이면 위, 회원이면 아래'로 읽고 아래를 누른다.
 * - 1 · 2장 오른쪽 위 [건너뛰기] → 마지막 장. 새 폰의 회원이 소개를 다 넘기지 않게
 * - 소개를 본 비회원이 / 로 들어오면 /start(이 화면을 마지막 장부터)로 온다(lib/start-redirect.ts)
 * - 카카오 버튼은 로그인을 쓸 수 있을 때(정식 주소)만, 이 기기에 로그인 기록이 없을 때만 보인다
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
      "국가·지자체에 나뉘어 있는 주거 지원금을\n한 목록으로 모아 둡니다.",
  },
  {
    character: "guide",
    glow: "bg-brand-200",
    eyebrowSr: "안내",
    title: "몇 가지 질문으로\n나에게 맞는 혜택을 안내해요",
    description:
      "생년월일·사는 곳·현재 상태·소득·주거 형태\n다섯 가지만 답하면 됩니다.",
  },
  {
    character: "success",
    glow: "bg-accent-100",
    eyebrowSr: "결과",
    title: "받을 수 있는 지원과\n실제 부담을 한눈에 확인해요",
    description:
      "최대 얼마를 받을 수 있고, 그러면 실제로\n얼마를 내게 되는지까지 계산해 드립니다.",
  },
];

const LAST = SLIDES.length - 1;

export const ONBOARDING_LAST = LAST;

export default function Onboarding({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  // 로그인 기록은 렌더에서 읽지 않는다(hydration). 처음 그린 뒤 한 번 본다 — 로그인한 사람이 소개를 다시 열면 카카오 버튼이 빠진다.
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => setLoggedIn(hasStoredLogin()), []);
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
    // 온보딩이 이 탭의 첫 화면이었으므로 첫 화면 기록도 /find 로 옮긴다. 안 옮기면 첫
    // 질문의 화살표가 history.back() 으로 앱 밖에 나간다.
    replaceKeepingEntry(router, to);
  }

  function logIn() {
    markOnboardingSeen();
    // 로그인한 회원은 홈으로. 처음 가입한 사람은 홈의 [시작하기]로 질문을 시작한다.
    return signIn("/home");
  }

  const slide = SLIDES[step];
  const isLast = step === LAST;
  const showKakao = isLast && isLoginAvailable() && !loggedIn;

  return (
    <AppShell className="relative">
      {/* 건너뛰기 — 마지막 장(시작 화면)으로. 화면 위에 띄워 줄을 차지하지 않는다: 줄로 두면 마지막 장에서
          사라질 때 그림과 글이 튀고, 자리를 잡아 두면 작은 화면에서 제목이 아래 버튼 칸에 가려진다. */}
      {!isLast && (
        <button
          type="button"
          onClick={() => setStep(LAST)}
          className="focus-ring absolute right-2 top-2 z-10 min-h-11 rounded-control px-3 text-sm font-bold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          건너뛰기
        </button>
      )}

      {/*
        한 장을 통째로 갈아 끼운다. key 가 바뀌면 slide-in 이 다시 돈다 —
        캐릭터가 먼저 자리를 잡고 글이 따라 온다.

        aria-live 는 쓰지 않는다. 제목으로 포커스를 옮기므로(위 useEffect) 같은
        내용을 두 번 읽게 된다.
      */}
      {/* 키 작은 화면(아이폰 SE 등)에서는 그림을 화면 높이에 맞춰 줄이고 간격을 좁힌다 — 마지막 장은 아래 버튼이
          둘이라(파랑 · 카카오) 제목과 설명이 버튼 칸에 가려지기 쉽다(11/20). */}
      <main key={step} className="flex flex-1 flex-col items-center justify-center gap-8 py-4 [@media(max-height:700px)]:gap-5 [@media(max-height:700px)]:py-3">
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
            className="slide-in relative h-auto w-[min(58vw,240px,30svh)] [@media(max-height:600px)]:w-[min(58vw,22svh)]"
          />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="slide-in whitespace-pre-line text-[28px] font-extrabold leading-[1.35] tracking-tight text-ink-900 outline-none [@media(max-height:600px)]:text-2xl"
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

        {/* 회원 → 바로 홈. 카카오 디자인 가이드대로 노랑 버튼 그대로, 문구는 가이드의 '로그인'. */}
        {showKakao && (
          <div className="mt-2">
            <KakaoButton onClick={logIn}>카카오로 로그인</KakaoButton>
          </div>
        )}

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
