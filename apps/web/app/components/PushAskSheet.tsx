"use client";

import { useState } from "react";
import { enablePush } from "@/lib/push";
import type { PushAskKind } from "@/lib/push-ask";
import { showToast } from "@/lib/toast";
import { Button } from "./Button";
import PerkyCharacter from "./PerkyCharacter";
import { Sheet } from "./Sheet";

/**
 * 알림 허용을 먼저 묻는 창 (11/23 ggue) — 언제 띄울지는 lib/push-ask.ts.
 *
 * 기기의 권한 창은 [알림 받기]를 누른 그 순간에 연다(enablePush) — 아이폰은 사용자 동작 직후에만 물을 수 있고,
 * 무엇을 알려 주는지 먼저 말해야 허용이 는다. 문구는 알림 설정 화면(PushSettings)과 같은 약속이다.
 *
 * kind="home-screen": 아이폰 Safari 처럼 홈 화면에 추가하지 않은 곳은 알림을 켤 수 없다 — 추가하는 법만 알린다.
 */
export function PushAskSheet({ kind, onClose }: { kind: PushAskKind; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const visual = <PerkyCharacter state="wave" size={72} priority className="h-auto w-[72px] shrink-0" />;

  if (kind === "home-screen") {
    return (
      <Sheet
        title="홈 화면에 추가하면 알림을 받을 수 있어요"
        description={
          <>
            아이폰은 Safari 아래쪽 공유 버튼 → <span className="whitespace-nowrap">‘홈 화면에 추가’로</span> Perky를 설치한 뒤에
            알림을 켤 수 있어요.
          </>
        }
        visual={visual}
        onClose={onClose}
      >
        <Button size="screen" data-autofocus onClick={onClose}>
          알겠어요
        </Button>
      </Sheet>
    );
  }

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    try {
      const state = await enablePush();
      if (state === "on") showToast({ message: "알림을 켰어요" });
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="새 지원금 소식, 알림으로 받을까요?"
      description="내 조건에 맞는 새 지원금이나 익산의 새 청약 공고가 올라오거나, 관심 지원금 마감이 7일 · 1일 남으면 알려 드려요 (낮 9시~밤 9시)"
      visual={visual}
      onClose={onClose}
    >
      <Button size="screen" data-autofocus disabled={busy} onClick={() => void turnOn()}>
        {busy ? "켜는 중…" : "알림 받기"}
      </Button>
      <Button size="screen" variant="text" disabled={busy} onClick={onClose}>
        나중에
      </Button>
      {failed && (
        <p role="alert" className="text-center text-sm text-danger-700">
          알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </Sheet>
  );
}
