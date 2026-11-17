import { AppShell, EmptyState, LinkButton, TopBar } from "@/app/components";

/**
 * 없는 페이지 (정적 export 가 404.html 로 굽는다). 없어요 Perky(empty) — 디자인 시안 '마스코트 배치 가이드'.
 * 빈 상태는 이유 한 줄과 다음 행동을 함께 말한다. "/" 는 로그인 기록이 있으면 홈, 없으면 온보딩·랜딩으로 보낸다.
 */
export default function NotFound() {
  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-1 flex-col justify-center">
        <EmptyState
          asHeading
          character="empty"
          title="찾는 페이지가 없어요"
          description="주소가 바뀌었거나 없어진 페이지예요."
          action={<LinkButton href="/" size="screen">처음 화면으로</LinkButton>}
        />
      </main>
    </AppShell>
  );
}
