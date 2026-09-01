/**
 * 모든 화면의 지면.
 *
 * 폭 상한은 max-w-lg(512px)다. 실사용은 사실상 전부 폰이지만 데스크톱에서 열었을 때
 * 한 줄이 화면 끝까지 늘어나면 읽는 눈이 줄 끝에서 처음으로 돌아오지 못한다.
 *
 * 좌우 여백 20px 은 320px 기기에서도 본문 폭 280px 을 남긴다. 이보다 좁히면
 * 금액 한 줄('최대 480만원')이 두 줄로 넘친다.
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
    <div className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 화면 하단에 붙어 스크롤과 무관하게 항상 손이 닿는 위치를 유지한다.
 *
 * -mx-5 로 지면 여백을 되물려 배경이 화면 폭 전체를 덮는다. 되물리지 않으면
 * 스크롤되는 본문이 CTA 좌우 5px 틈으로 비쳐 지나간다.
 *
 * 위쪽 그림자는 "아래에 더 있다"는 신호다. 배경이 canvas 와 같은 색이라
 * 그림자가 없으면 CTA 가 본문 위에 떠 있는지 붙어 있는지 알 수 없다.
 */
export function StickyBottomAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-canvas px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-sticky">
      {children}
    </div>
  );
}
