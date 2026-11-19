"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, DeadlineBadge, Icon3D, LinkButton, TopBar } from "@/app/components";
import { ChevronRight, FileText, Heart, ICON_MD, ICON_SM, ListChecks } from "@/app/components/icons";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { isClosedDeadline, savedCards, type SavedCard } from "@/lib/home";
import { replacePage } from "@/lib/redirect";
import { loadChecklist, loadDocumentChecks, loadSaved, onLocalChange } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * 관심 — 찜한 지원금만 모은 화면 (하단 섬 '관심' 탭, 11/20). 예전에 홈 아래에 있던 '찜한 지원금'을 옮겼다.
 * 찜은 로그인한 사람만 쓸 수 있어서(SaveButton) 홈과 같이 로그인 기록이 없으면 온보딩으로 보낸다.
 * 카드 모양 · 순서 · 진행 막대는 홈에 있을 때 그대로다 (lib/home.ts savedCards).
 */
export default function SavedPage() {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [today, setToday] = useState("");

  useEffect(() => {
    const leave = () => replacePage("/onboarding");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    const read = () => {
      setToday(seoulTodayISO());
      setSaved(loadSaved());
      setReady(true);
    };
    read();
    const checkLogin = () => {
      if (!hasStoredLogin()) leave();
    };
    // 다른 탭의 로그아웃은 lib/auth.ts 의 알림이 오지 않는다 — 브라우저의 storage 이벤트로 듣는다 (홈과 같다).
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY || event.key === null) checkLogin();
    };
    window.addEventListener("storage", onStorage);
    const offAuth = onAuthChange(checkLogin);
    const offLocal = onLocalChange(read);
    return () => {
      window.removeEventListener("storage", onStorage);
      offAuth();
      offLocal();
    };
  }, []);

  if (!ready) {
    return (
      <AppShell>
        <TopBar />
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </AppShell>
    );
  }

  const cards = savedCards(policies, saved, today, { checklist: loadChecklist, documents: loadDocumentChecks });

  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">관심</h1>
        <section aria-label="찜한 지원금" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-700">
            찜한 지원금
            {cards.length > 0 && (
              <>
                <span className="sr-only"> </span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-100 px-2 text-[13px] font-bold text-brand-800">
                  {cards.length}
                  <span className="sr-only">건</span>
                </span>
              </>
            )}
          </h2>
          {cards.length === 0 ? (
            <EmptySaved />
          ) : (
            <ul className="flex flex-col gap-3">
              {cards.map((card) => (
                <SavedCardItem key={card.policy.id} card={card} />
              ))}
            </ul>
          )}
        </section>
      </main>
      <BottomTabBar active="saved" />
    </AppShell>
  );
}

/** 390px 아래에서는 버튼을 글 아래 한 줄로 내린다 — 옆에 두면 320px 에서 제목이 두 줄, 설명이 세 줄로 꺾인다. */
function EmptySaved() {
  return (
    <div className="flex flex-col gap-3 rounded-card border-[1.5px] border-dashed border-brand-300 bg-surface p-4 min-[390px]:flex-row min-[390px]:items-center min-[390px]:gap-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Heart size={ICON_MD} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[15px] font-bold text-ink-900">아직 찜한 지원금이 없어요</p>
          <p className="text-[13px] leading-normal text-ink-500">목록에서 하트를 누르면 여기에 모여요</p>
        </div>
      </div>
      <LinkButton href="/find/policies" variant="secondary" size="md" full={false} className="w-full shrink-0 min-[390px]:w-auto">
        찾아보기
      </LinkButton>
    </div>
  );
}

function SavedCardItem({ card: { policy, deadline, progress } }: { card: SavedCard }) {
  // 마감·예정이면 진행 막대를 회색으로 — 지금은 신청할 수 없다. 준비해 둔 것은 그대로 보인다.
  const closed = isClosedDeadline(deadline);
  const ProgressIcon = progress.kind === "documents" ? FileText : ListChecks;
  return (
    <li>
      <Link
        href={`/find/policies/${policy.id}/prepare`}
        className="focus-ring flex items-center gap-2.5 rounded-card bg-surface py-[18px] pl-5 pr-3.5 shadow-card"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col items-start gap-1">
            <DeadlineBadge label={deadline} />
            {/* 목록 카드(PolicyCard)와 같은 자리 — 이름 · 기관 왼쪽에 정책 종류 그림 */}
            <div className="mt-0.5 flex items-center gap-3">
              <Icon3D name={policy.icon} size={40} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base font-bold leading-snug text-ink-900">{policy.name}</p>
                <p className="text-[13px] text-ink-500">
                  {policy.agency}
                  {deadline === "접수 마감" && " · 다음 공고를 기다려요"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={`flex items-center gap-1.5 text-[13px] font-bold ${closed ? "text-ink-600" : "text-brand-700"}`}>
              <ProgressIcon size={ICON_SM - 2} strokeWidth={2.25} aria-hidden="true" />
              {progress.label}
            </span>
            {/* 문구가 진행률을 이미 말한다 — 막대는 눈으로 보는 보조라 읽지 않는다. */}
            <div aria-hidden="true" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${progress.total}, minmax(0, 1fr))` }}>
              {Array.from({ length: progress.total }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full ${i < progress.done ? (closed ? "bg-ink-300" : "bg-brand-600") : "bg-ink-200"}`}
                />
              ))}
            </div>
          </div>
        </div>
        <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
      </Link>
    </li>
  );
}
