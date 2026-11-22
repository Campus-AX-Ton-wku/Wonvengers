"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthChange } from "@/lib/auth";
import { badgeStatuses, badgeOf, newBadges, nextBadge, type Badge } from "@/lib/badges";
import { readBadgeFacts } from "@/lib/badge-facts";
import { seoulTodayISO } from "@/lib/date";
import { DEFAULT_PROFILE_CARD } from "@/lib/profile-card";
import {
  badgesSeen,
  loadBadges,
  loadProfileCard,
  markBadgesSeen,
  onDeviceRecordChange,
  onLocalChange,
  saveBadges,
  saveProfileCard,
} from "@/lib/storage";
import { subscribeSync, syncReady } from "@/lib/sync";
import type { BadgeId } from "@/lib/user-data";
import { BadgeMedal } from "./BadgeMedal";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * 배지 판정 · 받는 순간 창 (내 프로필 설계 §7). 루트 레이아웃에 하나 — 어느 화면에서든 조건을 채운 그 자리에서.
 *
 * - 로그인했고 이 기기가 서버와 처음 맞춘 뒤(syncReady)에만 판정한다. 그 전에 사본에 배지를 적으면 충돌 창이 뜬다.
 * - 이 기기에서 처음 판정할 때는 창 없이 받은 날만 적는다(perky.badges-seen) — 업데이트 뒤 앱을 열자마자 창이 뜨지 않게.
 * - 그 뒤 새로 받은 배지는 창 하나로 — 여러 개면 첫 것만, 나머지는 내 정보 배지 칸에. 푸시는 보내지 않는다.
 * - 다시 보는 때: 답 · 관심 · 준비가 바뀔 때(onLocalChange), 달력 · 가이드 읽음(onDeviceRecordChange), 로그인 · 동기화 상태.
 */
export function BadgeWatcher() {
  const [shown, setShown] = useState<{ badge: Badge; next: Badge | null } | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    const check = () => {
      if (!syncReady()) return;
      const today = seoulTodayISO();
      const statuses = badgeStatuses(readBadgeFacts(today));
      const earned = loadBadges();
      const fresh = newBadges(statuses, earned);
      const seenBefore = badgesSeen();
      if (!seenBefore) markBadgesSeen();
      if (fresh.length === 0) return;
      const next = { ...earned };
      for (const id of fresh) next[id] = today;
      saveBadges(next);
      if (!seenBefore || shownRef.current) return;
      shownRef.current = true;
      setShown({ badge: badgeOf(fresh[0]), next: nextBadge(statuses, next) });
    };
    check();
    const offs = [onLocalChange(check), onDeviceRecordChange(check), onAuthChange(check), subscribeSync(check)];
    return () => offs.forEach((off) => off());
  }, []);

  if (!shown) return null;

  const close = () => {
    shownRef.current = false;
    setShown(null);
  };
  const pin = (id: BadgeId) => {
    saveProfileCard({ ...(loadProfileCard() ?? DEFAULT_PROFILE_CARD), pinnedBadge: id });
    close();
  };

  return (
    <Sheet
      title={`‘${shown.badge.label}’ 배지를 받았어요`}
      description={
        <>
          {shown.badge.desc}
          {shown.next && (
            <>
              {" "}
              다음 배지 ‘{shown.next.label}’ — {shown.next.howTo}
            </>
          )}
        </>
      }
      onClose={close}
    >
      {/* 배지 그림이 주인공 — 마스코트는 넣지 않는다(시안) */}
      <div className="flex justify-center pb-1">
        <BadgeMedal id={shown.badge.id} size="lg" />
      </div>
      <Button size="screen" onClick={() => pin(shown.badge.id)}>
        대표 배지로 걸기
      </Button>
      <Button size="screen" variant="text" data-autofocus onClick={close}>
        좋아요
      </Button>
    </Sheet>
  );
}
