// apps/web/app/account/PushSettings.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components";
import { hasConsent, storedSub } from "@/lib/auth";
import { disablePush, enablePush, pushState, pushSupport, refreshPush } from "@/lib/push";

type View = "loading" | "unsupported" | "needs-home-screen" | "no-consent" | "denied" | "off" | "on";

const NOTE: Partial<Record<View, string>> = {
  unsupported: "이 브라우저는 알림을 지원하지 않아요",
  "needs-home-screen": "홈 화면에 추가한 Perky에서 알림을 켤 수 있어요",
  "no-consent": "답을 저장해야 맞춤 알림을 받을 수 있어요",
  denied: "알림이 꺼져 있어요. 기기 설정에서 Perky 알림을 허용해 주세요",
};

/**
 * 내 계정 › 알림 (docs/기획/2026-11-16-새-정책-알림-설계.md "내 계정 화면 — 알림 칸").
 * 부모(account/page.tsx)가 isPushConfigured() 일 때만 그린다.
 */
export default function PushSettings() {
  const [view, setView] = useState<View>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const support = pushSupport();
      if (support !== "ready") return setView(support);
      const sub = storedSub();
      if (!sub || !hasConsent(sub)) return setView("no-consent");
      const state = await pushState().catch(() => "off" as const);
      if (!alive) return;
      setView(state);
      if (state === "on") void refreshPush();
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    try {
      setView(await enablePush());
    } catch {
      setFailed(true);
      setView("off");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
    } finally {
      setView("off");
      setBusy(false);
    }
  }

  const note = NOTE[view];
  return (
    <section aria-labelledby="push-heading" className="flex flex-col gap-2">
      <h2 id="push-heading" className="text-base font-bold text-ink-900">
        알림
      </h2>
      {view === "loading" && <p className="text-sm text-ink-500">확인하는 중…</p>}
      {note && <p className="text-sm leading-relaxed text-ink-600">{note}</p>}
      {view === "off" && (
        <>
          <p className="text-sm leading-relaxed text-ink-600">
            새 지원금이 올라오면 내 조건에 맞는지 보고 알려 드려요 (낮 9시~밤 9시)
          </p>
          <Button variant="secondary" size="screen" disabled={busy} onClick={() => void turnOn()}>
            {busy ? "켜는 중…" : "알림 켜기"}
          </Button>
        </>
      )}
      {view === "on" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink-900">알림 켜짐</p>
          <Button variant="text" size="md" full={false} disabled={busy} onClick={() => void turnOff()}>
            알림 끄기
          </Button>
        </div>
      )}
      {failed && (
        <p role="alert" className="rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-700">
          알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
}
