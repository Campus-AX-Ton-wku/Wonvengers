"use client";

import { AppShell, Button, EmptyState, LinkButton, TopBar } from "@/app/components";
import { reloadPage } from "@/lib/redirect";

/**
 * 화면 하나가 그리다 깨졌을 때 (Next 오류 경계). 생각 중 Perky(thinking) — 디자인 시안 '마스코트 배치 가이드'의 '오류 · 연결 끊김'.
 *
 * 화면을 그리다 던진 오류와, 화면 코드 조각을 받다 실패한 경우(ChunkLoadError)가 여기로 온다. 그래서 [다시 시도]는
 * reset() 이 아니라 페이지를 새로 연다 — reset 은 같은 코드로 다시 그릴 뿐 못 받은 조각을 다시 받지 않는다.
 * 이게 없으면 Next 기본 화면("Application error: a client-side exception has occurred")이 영어로 뜬다.
 *
 * 주의: 연결이 완전히 끊긴 채 다른 화면으로 가면 Next 는 이 화면 대신 브라우저 이동으로 넘어간다(11/17 Playwright 로
 * 확인 — 다음 화면 코드를 막자 페이지를 새로 불렀다). 그때는 브라우저의 오프라인 화면이 먼저 뜬다.
 */
export default function ErrorPage({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-1 flex-col justify-center">
        <EmptyState
          asHeading
          character="thinking"
          title="화면을 불러오지 못했어요"
          description="인터넷 연결이 끊겼거나 잠깐 문제가 생겼어요. 연결을 확인하고 다시 시도해 주세요. 입력한 답은 이 기기에 그대로 있어요."
          action={
            <>
              <Button size="screen" onClick={() => reloadPage()}>다시 시도</Button>
              <LinkButton href="/" variant="secondary" size="screen">처음 화면으로</LinkButton>
            </>
          }
        />
      </main>
    </AppShell>
  );
}
