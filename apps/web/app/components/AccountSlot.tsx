"use client";

import { useEffect, useState } from "react";
import policiesJson from "@/data/policies.json";
import { hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { hasUnseen, inboxItems, INBOX_SEEN_EVENT, loadInboxSeen } from "@/lib/inbox";
import { reloadPage } from "@/lib/redirect";
import { loadAnswers, loadChecklist, loadDocumentChecks, loadSaved, onLocalChange } from "@/lib/storage";
import { retrySync, startSync, useSyncState } from "@/lib/sync";
import type { PolicyMeta } from "@/lib/types";
import { IconLink } from "./IconButton";
import { SyncConflictSheet } from "./SyncConflictSheet";
import { TabIcon } from "./TabIcons";

/**
 * 상단바 오른쪽 자리 (설계 '화면' 4). 로그인 전에는 비워 두고(폭만 잡는다), 로그인 후 알림 종.
 *
 * 11/20 하단 섬 탭(BottomTabBar)으로 [홈] · [내 계정]을 옮겼다 — 이동은 아래, 상단바에는 도구만.
 * 종은 알림함(/notifications)으로 간다. 아직 보지 않은 알림이 있으면 종에 빨간 점(lib/inbox.ts).
 *
 * 이 칸이 그려질 때 동기화를 켠다(startSync — 로그인 + 동의가 아니면 아무것도 하지 않는다). 답을 고치는
 * 화면은 모두 상단바가 있어서, 저장 알림을 들을 쪽이 그 전에 붙는다. 하단 섬이 없는 단계 화면에서도
 * 저장 실패를 알려야 하므로 이 일은 상단바에 남긴다.
 *
 * 저장 실패는 이 칸 아래에 떠 있는 "저장 안 됨 · 다시 시도"(+ 하단 섬 '내 정보'의 점). 칸이 44px 라
 * 문구를 칸 안에 넣으면 줄이 밀린다 — 떠 있게 두어 레이아웃을 움직이지 않는다.
 */
const policies = policiesJson as PolicyMeta[];

/** 알림함에 아직 보지 않은 알림이 있는지 — 내 답 · 찜이 바뀌거나 알림함을 보면 다시 센다. */
function useInboxDot(enabled: boolean): boolean {
  const [dot, setDot] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      const items = inboxItems(policies, loadAnswers(), loadSaved(), seoulTodayISO(), {
        checklist: loadChecklist,
        documents: loadDocumentChecks,
      });
      setDot(hasUnseen(items, loadInboxSeen()));
    };
    read();
    const off = onLocalChange(read);
    window.addEventListener(INBOX_SEEN_EVENT, read);
    return () => {
      off();
      window.removeEventListener(INBOX_SEEN_EVENT, read);
    };
  }, [enabled]);
  return dot;
}

export function AccountSlot() {
  const [signedIn, setSignedIn] = useState(false);
  const sync = useSyncState();
  const dot = useInboxDot(signedIn);

  useEffect(() => {
    if (!isLoginAvailable()) return;
    const update = () => setSignedIn(hasStoredLogin());
    update();
    startSync();
    return onAuthChange(update);
  }, []);

  if (!signedIn) return <span className="w-11" aria-hidden="true" />;

  const failed = sync.status === "error";
  return (
    <div className="relative flex items-center">
      <IconLink href="/notifications" label={dot ? "알림 (새 소식 있음)" : "알림"} className="relative">
        <TabIcon name="bell" />
        {dot && <span aria-hidden="true" className="absolute right-2.5 top-2 size-2 rounded-full bg-danger-600 ring-2 ring-canvas" />}
      </IconLink>
      {failed && (
        <button
          type="button"
          onClick={() => void retrySync()}
          className="focus-ring absolute right-0 top-full z-30 mt-1 inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-warn-50 px-3 text-xs font-bold text-warn-800 shadow-card"
        >
          저장 안 됨 · 다시 시도
        </button>
      )}
      {sync.status === "conflict" && sync.conflict && (
        <SyncConflictSheet
          onResolved={(choice) => {
            // 화면들은 마운트 때 사본을 한 번 읽는다. 저장된 답으로 바꿨으면 다시 연다.
            if (choice === "remote") reloadPage();
          }}
        />
      )}
    </div>
  );
}
