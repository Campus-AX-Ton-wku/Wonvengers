"use client";

import { useEffect, useState } from "react";
import { AppShell, TopBar } from "@/app/components";
import { hasStoredLogin, isLoginAvailable } from "@/lib/auth";
import { isPushConfigured } from "@/lib/push";
import { replacePage } from "@/lib/redirect";
import PushSettings from "./PushSettings";

/**
 * 알림 설정 — 알림함(/notifications) 오른쪽 위 ⚙ 의 두 번째 화면 (11/20 두 단계 구조, docs/기획/2026-11-20-알림함-설계.md).
 * 예전에는 내 정보 화면 안 알림 칸이라 '내 정보'와 '알림'이 같은 화면이었다. 휴대폰 알림(새 정책 · 찜 마감 푸시)
 * 켜기 · 끄기를 그대로 옮겼다. 찜이 로그인 기능이라 /saved · /notifications 처럼 로그인 기록이 없으면 온보딩으로.
 */
export default function NotificationSettingsPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoginAvailable() || !hasStoredLogin()) {
      replacePage("/onboarding");
      return;
    }
    setReady(true);
  }, []);

  return (
    <AppShell>
      {/* 오른쪽 칸을 비운다 — 종(알림함)은 왼쪽 ← 와 같은 곳이다 */}
      <TopBar backHref="/notifications" right={<span className="w-11" aria-hidden="true" />} />
      <main className="flex flex-col gap-8 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">알림 설정</h1>
        {ready &&
          (isPushConfigured() ? (
            <PushSettings />
          ) : (
            <p className="text-sm leading-relaxed text-ink-600">이 환경에서는 휴대폰 알림을 쓸 수 없어요.</p>
          ))}
      </main>
    </AppShell>
  );
}
