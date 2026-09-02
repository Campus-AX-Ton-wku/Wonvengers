/**
 * 모든 화면의 지면.
 *
 * 폭 상한은 420px이다. 실사용은 사실상 전부 폰이지만 데스크톱에서 열었을 때
 * 한 줄이 화면 끝까지 늘어나면 읽는 눈이 줄 끝에서 처음으로 돌아오지 못한다.
 *
 * 좌우 여백은 320px 에서 16px, 390px 이상에서 20px 이다. 작은 화면에서 본문
 * 폭 288px 을 확보하면서 390px 기준 디자인의 350px 본문 폭을 그대로 지킨다.
 *
 * min-h-dvh — 100vh 는 모바일 브라우저 주소창 높이를 포함해서, 하단 고정 CTA 가
 * 화면 밖으로 밀린다. dvh 는 실제로 보이는 높이다.
 */
export function AppShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full flex-col px-4 min-[390px]:px-5 md:max-w-[420px] ${className}`}>
      {children}
    </div>
  );
}

/**
 * 화면 하단에 붙어 스크롤과 무관하게 항상 손이 닿는 위치를 유지한다.
 *
 * AppShell 의 반응형 좌우 여백을 같은 값으로 되물려 배경이 화면 폭 전체를 덮는다.
 *
 * 위쪽 그림자는 "아래에 더 있다"는 신호다. 배경이 canvas 와 같은 색이라
 * 그림자가 없으면 CTA 가 본문 위에 떠 있는지 붙어 있는지 알 수 없다.
 */
export function StickyBottomAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-canvas px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-sticky min-[390px]:-mx-5 min-[390px]:px-5">
      {children}
    </div>
  );
}
