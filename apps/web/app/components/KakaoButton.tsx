/**
 * 카카오 로그인 버튼 — 카카오 디자인 가이드의 색과 모양(노란 바탕 #FEE500, 검은 말풍선 심볼,
 * 글자 85% 검정, 모서리 12px). 이 앱의 파랑 버튼 체계(Button.tsx) 밖에 있는 유일한 버튼이다.
 * https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide
 */
export function KakaoButton({
  onClick,
  disabled = false,
  children = "카카오로 계속하기",
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#FEE500] px-5 text-base font-bold text-black/85 transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="#000000">
        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.87 5.37 4.68 6.78l-1.2 4.4c-.1.38.33.68.66.46l5.24-3.47c.2.02.41.03.62.03 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
      </svg>
      {children}
    </button>
  );
}
