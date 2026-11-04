"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Button, KakaoButton, LinkButton, Sheet, TopBar } from "@/app/components";
import { hasStoredLogin, isLoginAvailable, onAuthChange, signIn } from "@/lib/auth";
import { flushNow, hasUnsyncedChanges, logout, retrySync, useSyncState, withdraw } from "@/lib/sync";

/** 2026.11.04 18:00 — 이 기기 시간대로. */
function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 계정 (설계 '화면' 5). 로그인 상태, 마지막 저장 시각, 로그아웃, 회원 탈퇴, 처리방침 링크.
 * "저장된 답 지우기"는 따로 두지 않는다 — 답을 고르는 흐름 안의 '처음부터 다시'가 그 일을 한다.
 *
 * 회원 탈퇴가 끝나면 이 기기 사본을 지우고 로그아웃한 뒤 여기서 "탈퇴가 끝났어요"를 말한다.
 * Cognito 사용자는 이미 지워져서 Cognito 로그아웃 화면으로 보내지 않는다.
 *
 * 로그아웃은 이 기기의 사본을 지우고 Cognito 로 떠난다 — 지운 뒤에는 알릴 틈이 없다. 그래서 먼저 남은 쓰기를
 * 올려 보고(flushNow), 그래도 올리지 못한 변경·고르지 않은 충돌이 남으면 "저장 안 된 변경이 있어요"로 묻는다.
 */
export default function AccountPage() {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const sync = useSyncState();

  useEffect(() => {
    const update = () => {
      const ok = isLoginAvailable();
      setAvailable(ok);
      setSignedIn(ok && hasStoredLogin());
    };
    update();
    setReady(true);
    return onAuthChange(update);
  }, []);

  async function requestLogout() {
    setLoggingOut(true);
    await flushNow();
    if (hasUnsyncedChanges()) {
      setLoggingOut(false);
      setConfirmingLogout(true);
      return;
    }
    await logout();
  }

  async function confirmLogout() {
    setConfirmingLogout(false);
    setLoggingOut(true);
    await logout();
  }

  async function confirmWithdraw() {
    setWorking(true);
    setFailed(false);
    try {
      await withdraw();
      setWithdrawn(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  }

  const heading = "text-2xl font-extrabold leading-snug text-ink-900";
  const body = "text-sm leading-relaxed text-ink-600";

  return (
    <AppShell>
      <TopBar backHref="/find" />
      <main className="flex flex-1 flex-col gap-6 pb-10 pt-4">
        {!ready ? (
          <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
        ) : withdrawn ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>탈퇴가 끝났어요</h1>
            <p className={body}>
              저장된 답과 회원 정보를 모두 지우고 카카오 연결도 끊었어요. 다시 카카오로 로그인하면 새 회원으로 시작해요.
            </p>
            <LinkButton href="/find" variant="secondary">
              질문으로 가기
            </LinkButton>
          </section>
        ) : !available ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>지금은 로그인을 쓸 수 없어요</h1>
            <p className={body}>로그인하지 않아도 모든 기능을 그대로 쓸 수 있어요. 답은 이 기기에만 저장돼요.</p>
          </section>
        ) : !signedIn ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>로그인하지 않았어요</h1>
            <p className={body}>
              지금 고른 답은 이 기기에만 있어요. 카카오로 로그인하면 다른 기기에서도 이어 볼 수 있어요.
            </p>
            <KakaoButton onClick={() => signIn("/account")} />
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h1 className={heading}>내 계정</h1>
              <p className="text-sm text-ink-700">카카오로 로그인했어요</p>
              <p className="text-sm text-ink-500">
                {sync.lastSavedAt ? `마지막 저장 ${formatSavedAt(sync.lastSavedAt)}` : "아직 저장 전이에요"}
              </p>
              {sync.status === "error" && (
                <div
                  role="status"
                  className="mt-1 flex items-center justify-between gap-3 rounded-control bg-warn-50 px-4 py-2 text-sm text-warn-800"
                >
                  <span>저장 안 된 변경이 있어요. 로그아웃하면 이 기기에서 사라져요.</span>
                  <Button variant="text" size="md" full={false} onClick={() => void retrySync()}>
                    다시 시도
                  </Button>
                </div>
              )}
            </section>
            <div className="flex flex-col gap-2">
              <Button variant="quiet" size="screen" disabled={loggingOut} onClick={() => void requestLogout()}>
                {loggingOut ? "로그아웃하는 중…" : "로그아웃"}
              </Button>
              <Button
                variant="text"
                size="md"
                onClick={() => {
                  setFailed(false);
                  setConfirming(true);
                }}
              >
                회원 탈퇴
              </Button>
            </div>
            {failed && (
              <p role="alert" className="rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-700">
                탈퇴하지 못했어요. 아무것도 지우지 않았으니 잠시 뒤 다시 시도해 주세요.
              </p>
            )}
          </>
        )}

        <Link href="/privacy" className="focus-ring inline-flex min-h-11 w-fit items-center text-sm font-bold text-brand-700 underline">
          개인정보 처리방침
        </Link>
      </main>

      {confirming && (
        <Sheet
          title="회원 탈퇴할까요?"
          description="저장된 답과 회원 정보가 모두 지워지고 되돌릴 수 없어요."
          onClose={() => {
            if (!working) setConfirming(false);
          }}
        >
          <Button size="screen" variant="danger" disabled={working} onClick={() => void confirmWithdraw()}>
            {working ? "탈퇴하는 중…" : "탈퇴하기"}
          </Button>
          <Button size="screen" variant="text" data-autofocus disabled={working} onClick={() => setConfirming(false)}>
            취소
          </Button>
        </Sheet>
      )}

      {confirmingLogout && (
        <Sheet
          title="저장 안 된 변경이 있어요"
          description="로그아웃하면 이 기기에서 저장하지 못한 변경이 사라져요. 인터넷 연결을 확인하고 '다시 시도'로 먼저 저장할 수 있어요."
          onClose={() => setConfirmingLogout(false)}
        >
          <Button size="screen" variant="danger" onClick={() => void confirmLogout()}>
            그래도 로그아웃
          </Button>
          <Button size="screen" variant="text" data-autofocus onClick={() => setConfirmingLogout(false)}>
            취소
          </Button>
        </Sheet>
      )}
    </AppShell>
  );
}
