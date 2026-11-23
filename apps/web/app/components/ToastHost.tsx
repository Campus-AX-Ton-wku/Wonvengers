"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onToast, type ToastInput } from "@/lib/toast";

/** 알림이 떠 있는 시간 · 사라지는 움직임 시간 */
const SHOW_MS = 2600;
const LEAVE_MS = 220;

interface Toast extends ToastInput {
  id: number;
  leaving: boolean;
}

/**
 * 아래 알림(토스트) 자리 — 루트 레이아웃에 하나 (11/23 ggue, 토스 영상 #3 · #4).
 * - 아래에서 작게 커지며 0.2초에 올라오고, 처음엔 작은 초록 점이던 아이콘이 0.3초 뒤 동그라미로 커지며 체크가 그려진다.
 * - 새 알림이 오면 앞 알림은 아래로 빠지며 사라진다(같은 자리에 하나만 남는다).
 * - 하단 탭이 있는 화면에서는 탭 위에, 없으면 화면 아래에. 2.6초 뒤 스스로 사라진다.
 * - 화면 읽기 프로그램에는 role="status" 로 문장을 읽어 준다.
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [aboveTabs, setAboveTabs] = useState(false);
  const nextId = useRef(1);

  useEffect(
    () =>
      onToast((input) => {
        setAboveTabs(document.querySelector('nav[aria-label="주요 메뉴"]') !== null);
        const id = nextId.current++;
        setToasts((prev) => [...prev.map((t) => ({ ...t, leaving: true })), { ...input, id, leaving: false }]);
      }),
    []
  );

  useEffect(() => {
    const timers = toasts.map((t) =>
      t.leaving
        ? setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), LEAVE_MS)
        : setTimeout(() => setToasts((prev) => prev.map((x) => (x.id === t.id ? { ...x, leaving: true } : x))), SHOW_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 ${
        aboveTabs ? "bottom-[calc(env(safe-area-inset-bottom)+6.25rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      }`}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-toast
          data-leaving={t.leaving ? "true" : "false"}
          className={`pointer-events-auto absolute bottom-0 flex w-[calc(100%-2rem)] max-w-[350px] items-center gap-2.5 rounded-full bg-ink-900 py-1.5 pl-3.5 pr-1.5 text-sm font-semibold text-canvas shadow-card ${
            t.leaving ? "toast-out" : "toast-in"
          }`}
        >
          <ToastCheck />
          <span className="min-w-0 flex-1 truncate py-2.5">{t.message}</span>
          {t.action && (
            <Link
              href={t.action.href}
              className="focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full bg-canvas/15 px-3.5 text-[13px] font-bold"
            >
              {t.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** 초록 동그라미 + 체크 — 동그라미가 커진 뒤 체크가 그려진다 */
function ToastCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
      <circle className="toast-check-circle" cx="11" cy="11" r="10" fill="var(--color-ok-700)" />
      <path
        className="toast-check-mark"
        d="M6.5 11.3 9.6 14.2 15.5 8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
