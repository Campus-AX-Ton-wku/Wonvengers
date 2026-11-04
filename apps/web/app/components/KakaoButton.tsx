"use client";

import { useEffect, useState } from "react";

/**
 * 카카오 로그인 버튼 — 카카오 디자인 가이드의 색과 모양(노란 바탕 #FEE500, 검은 말풍선 심볼,
 * 글자 85% 검정, 모서리 12px). 이 앱의 파랑 버튼 체계(Button.tsx) 밖에 있는 유일한 버튼이다.
 * https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide
 *
 * onClick 이 Promise 를 돌려주면(signIn) 그동안 버튼을 막는다 — 로그인 모듈을 불러오는 사이 두 번 눌러
 * 두 요청이 나가지 않게. 성공하면 페이지가 카카오로 떠나므로 막힌 채로 둔다. 뒤로가기로 bfcache 에서
 * 돌아오면(pageshow persisted) 다시 풀어 준다. 실패하면 풀고 버튼 아래에 짧게 알린다.
 */
export const KAKAO_START_ERROR = "지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요";

export function KakaoButton({
  onClick,
  disabled = false,
  children = "카카오로 계속하기",
}: {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function handleClick() {
    if (pending) return;
    setFailed(false);
    const result = onClick();
    if (!result) return;
    setPending(true);
    result.catch(() => {
      setPending(false);
      setFailed(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#FEE500] px-5 text-base font-bold text-black/85 transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="#000000">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.87 5.37 4.68 6.78l-1.2 4.4c-.1.38.33.68.66.46l5.24-3.47c.2.02.41.03.62.03 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
        </svg>
        {children}
      </button>
      {failed && (
        <p role="alert" className="text-center text-sm text-warn-800">
          {KAKAO_START_ERROR}
        </p>
      )}
    </>
  );
}
