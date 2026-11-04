"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell, SyncConflictSheet, TopBar, buttonClass } from "@/app/components";
import { consumeReturnTo, handleCallback, isLoginAvailable } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { initialSync } from "@/lib/sync";

type Phase = "working" | "conflict" | "error" | "cancelled" | "unavailable";

/**
 * Cognito 가 돌려보내는 곳 (설계 '화면' 2). 정적 페이지다 — 주소의 code·state 는 브라우저에서 읽는다
 * (useSearchParams 를 쓰지 않아 Suspense 경계가 필요 없다).
 *
 * 코드 교환 뒤: 이 기기에서 이 사람이 지금 문구에 동의한 적이 없으면 /auth/consent(서버 호출 없음),
 * 있으면 서버와 맞춘 뒤 로그인 전 화면으로. 맞추기가 실패해도 로그인은 됐으니 돌아간다 — 상단바가 다시 시도한다.
 * 돌아갈 때는 페이지를 새로 연다(replacePage) — 화면들이 마운트 때 사본을 읽는다.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("working");
  /** 로그인하지 못했을 때 "로그인 없이 계속하기"가 가는 곳 — 시트를 띄운 화면의 목적지. 결과를 막지 않는다. */
  const [fallback, setFallback] = useState("/find");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isLoginAvailable()) {
      setPhase("unavailable");
      return;
    }
    void (async () => {
      const signedIn = await handleCallback(window.location.href).catch(() => null);
      if (signedIn === null) {
        setFallback(consumeReturnTo());
        // 카카오 동의 화면에서 [취소]하면 Cognito 가 error=access_denied 로 돌려보낸다.
        const cancelled = new URLSearchParams(window.location.search).get("error") === "access_denied";
        setPhase(cancelled ? "cancelled" : "error");
        return;
      }
      if (signedIn.needsConsent) {
        router.replace("/auth/consent");
        return;
      }
      try {
        if ((await initialSync()) === "conflict") {
          setPhase("conflict");
          return;
        }
      } catch {
        // 위 주석 — 그래도 돌아간다.
      }
      replacePage(consumeReturnTo());
    })();
  }, [router]);

  const done = phase === "error" || phase === "cancelled" || phase === "unavailable";
  const failed = phase === "error" || phase === "cancelled";

  return (
    <AppShell>
      <TopBar right={<span className="w-11" aria-hidden="true" />} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        {done ? (
          <>
            <h1 className="text-xl font-extrabold text-ink-900">
              {phase === "unavailable"
                ? "지금은 로그인을 쓸 수 없어요"
                : phase === "cancelled"
                  ? "로그인을 취소했어요"
                  : "로그인하지 못했어요"}
            </h1>
            <p className="text-sm leading-relaxed text-ink-600">
              로그인하지 않아도 모든 기능을 그대로 쓸 수 있어요. 답은 이 기기에 저장돼요.
            </p>
            {failed && (
              <Link replace href={fallback} className={buttonClass({ size: "screen", full: false })}>
                로그인 없이 계속하기
              </Link>
            )}
            {!(failed && fallback === "/find") && (
              <Link href="/find" className={buttonClass({ variant: "secondary", size: "md", full: false })}>
                질문으로 돌아가기
              </Link>
            )}
          </>
        ) : (
          <p role="status" className="text-sm text-ink-500">
            로그인하는 중…
          </p>
        )}
      </main>
      {phase === "conflict" && <SyncConflictSheet onResolved={() => replacePage(consumeReturnTo())} />}
    </AppShell>
  );
}
