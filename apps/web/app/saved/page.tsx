"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, DeadlineBadge, Icon3D, LinkButton, TopBar } from "@/app/components";
import { ChevronRight, FileText, Heart, ICON_MD, ICON_SM, ListChecks } from "@/app/components/icons";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { isClosedDeadline, savedCards, sortSavedCards, type SavedCard, type SavedSort } from "@/lib/home";
import { replacePage } from "@/lib/redirect";
import { loadChecklist, loadDocumentChecks, loadSaved, onLocalChange } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * 관심 — 찜한 지원금만 모은 화면 (하단 섬 '관심' 탭, 11/20). 예전에 홈 아래에 있던 '찜한 지원금'을 옮겼다.
 * 찜은 로그인한 사람만 쓸 수 있어서(SaveButton) 홈과 같이 로그인 기록이 없으면 온보딩으로 보낸다.
 * 카드 모양 · 진행 막대는 홈에 있을 때 그대로다 (lib/home.ts savedCards).
 * 정렬은 '마감 가까운 순'이 기본, '최근 찜한 순'으로 바꿀 수 있다 (sortSavedCards). 고른 정렬은 이 화면에서만 산다.
 */
export default function SavedPage() {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [sort, setSort] = useState<SavedSort>("deadline");

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

  const cards = sortSavedCards(savedCards(policies, saved, today, { checklist: loadChecklist, documents: loadDocumentChecks }), sort, today);

  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">관심</h1>
        <section aria-label="관심 지원금" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-700">
              관심 지원금
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
            {cards.length > 1 && <SortChips value={sort} onChange={setSort} />}
          </div>
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

const SORTS: { value: SavedSort; label: string }[] = [
  { value: "deadline", label: "마감 가까운 순" },
  { value: "recent", label: "최근 추가한 순" },
];

/** 정렬 칩 두 개 — 고른 칩은 진한 남색 면 + aria-pressed. 44px 터치 높이는 칩 바깥 여백으로 채운다. */
function SortChips({ value, onChange }: { value: SavedSort; onChange: (sort: SavedSort) => void }) {
  return (
    <div role="group" aria-label="정렬" className="flex gap-1.5">
      {SORTS.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`focus-ring inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-bold transition-colors ${
              on ? "bg-ink-900 text-surface" : "bg-surface text-ink-700 shadow-btn-quiet hover:bg-ink-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 비었을 때 (시안 '관심 탭 · 비었을 때', 11/20) — 가운데 정렬 카드 하나. 탭 이름은 '관심', 버튼은 하트라서
 * "하트를 누르면 여기에 모여요"로 둘을 잇는다. 이 화면에서 할 일은 하나뿐이라 버튼은 파랑(primary).
 */
function EmptySaved() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-brand-200 bg-surface px-5 pb-6 pt-7 text-center">
      <span aria-hidden="true" className="empty-pop flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Heart size={ICON_MD} />
      </span>
      <p className="mt-1 text-base font-bold text-ink-900">아직 관심 지원금이 없어요</p>
      <p className="text-sm leading-relaxed text-ink-600">
        지원금 목록에서 하트를 누르면
        <br />
        여기에 모여요
      </p>
      <LinkButton href="/find/policies" size="screen" full={false} className="mt-3">
        지원금 보러 가기
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
        className="press focus-ring flex items-center gap-2.5 rounded-card bg-surface py-[18px] pl-5 pr-3.5 shadow-card"
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
