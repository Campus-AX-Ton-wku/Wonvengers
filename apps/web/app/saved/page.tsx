"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, DeadlineBadge, Icon3D, LinkButton, TopBar } from "@/app/components";
import { ChevronRight, CircleCheck, ExternalLink, FileText, Heart, ICON_MD, ICON_SM, ListChecks } from "@/app/components/icons";
import { appliedDayLabel, appliedIds, notAppliedIds } from "@/lib/applied";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { isClosedDeadline, savedCards, savedViewFromSearch, sortSavedCards, type SavedCard, type SavedSort, type SavedView } from "@/lib/home";
import { hasStartedPreparing } from "@/lib/preparation";
import { replacePage } from "@/lib/redirect";
import { loadApplied, loadChecklist, loadDocumentChecks, loadSaved, onLocalChange } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * 관심 — 찜한 지원금만 모은 화면 (하단 섬 '관심' 탭, 11/20). 예전에 홈 아래에 있던 '찜한 지원금'을 옮겼다.
 * 찜은 로그인한 사람만 쓸 수 있어서(SaveButton) 홈과 같이 로그인 기록이 없으면 온보딩으로 보낸다.
 * 카드 모양 · 진행 막대는 홈에 있을 때 그대로다 (lib/home.ts savedCards).
 * 정렬은 '마감 가까운 순'이 기본, '최근 찜한 순'으로 바꿀 수 있다 (sortSavedCards). 고른 정렬은 이 화면에서만 산다.
 * 보기는 '전체' · '신청 준비 중'(체크리스트를 하나라도 체크한 것, 11/23 ggue) · '신청 완료'('신청을 마쳤어요'로 표시한 것,
 * 11/23 ggue — 관심을 안 눌렀어도 모인다. 전체 · 신청 준비 중에서는 빠진다) — 내 정보 '신청 준비 중'은 ?view=preparing 으로 연다.
 * 고른 보기는 주소에 남겨(replaceState, 기록 안 쌓음) 카드를 눌렀다 뒤로 와도 같은 보기다.
 */
export default function SavedPage() {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setAppliedIds] = useState<Record<string, string>>({});
  const [today, setToday] = useState("");
  const [sort, setSort] = useState<SavedSort>("deadline");
  const [view, setView] = useState<SavedView>("all");

  useEffect(() => {
    const leave = () => replacePage("/onboarding");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    setView(savedViewFromSearch(window.location.search));
    const read = () => {
      setToday(seoulTodayISO());
      setSaved(loadSaved());
      setAppliedIds(loadApplied());
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

  const all = savedCards(policies, notAppliedIds(saved, applied), today, { checklist: loadChecklist, documents: loadDocumentChecks });
  const preparing = all.filter(({ policy }) => hasStartedPreparing(policy, loadChecklist(policy.id), loadDocumentChecks(policy.id)));
  const byId = new Map(policies.map((p) => [p.id, p]));
  const done = appliedIds(applied).flatMap((id) => {
    const policy = byId.get(id);
    return policy ? [{ policy, day: applied[id] }] : [];
  });
  const cards = view === "applied" ? [] : sortSavedCards(view === "preparing" ? preparing : all, sort, today);
  const count = view === "applied" ? done.length : cards.length;
  const title = view === "preparing" ? "신청 준비 중" : view === "applied" ? "신청 완료" : "관심 지원금";
  const changeView = (next: SavedView) => {
    setView(next);
    window.history.replaceState(window.history.state, "", next === "all" ? window.location.pathname : `?view=${next}`);
  };

  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">관심</h1>
        {all.length + done.length > 0 && (
          <ViewTabs value={view} onChange={changeView} counts={{ all: all.length, preparing: preparing.length, applied: done.length }} />
        )}
        <section aria-label={title} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-700">
              {title}
              {count > 0 && (
                <>
                  <span className="sr-only"> </span>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-100 px-2 text-[13px] font-bold text-brand-800">
                    {count}
                    <span className="sr-only">건</span>
                  </span>
                </>
              )}
            </h2>
            {cards.length > 1 && <SortChips value={sort} onChange={setSort} />}
          </div>
          {view === "applied" ? (
            done.length === 0 ? (
              <EmptyApplied />
            ) : (
              <ul className="flex flex-col gap-3">
                {done.map(({ policy, day }) => (
                  <AppliedCardItem key={policy.id} policy={policy} day={day} />
                ))}
              </ul>
            )
          ) : all.length === 0 && done.length === 0 ? (
            <EmptySaved />
          ) : all.length === 0 ? (
            <EmptyAllApplied onShowApplied={() => changeView("applied")} />
          ) : cards.length === 0 ? (
            <EmptyPreparing onShowAll={() => changeView("all")} />
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

/**
 * 보기 세 칸 — 전체 · 신청 준비 중 · 신청 완료 (11/23). 정렬 칩(작은 알약)과 헷갈리지 않게 화면 폭을 채우는 두 칸 막대로,
 * 고른 칸은 흰 면 + 그림자. 관심 지원금이 하나도 없으면 두지 않는다(빈 안내 하나만).
 */
function ViewTabs({ value, onChange, counts }: { value: SavedView; onChange: (view: SavedView) => void; counts: Record<SavedView, number> }) {
  const options: { value: SavedView; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "preparing", label: "신청 준비 중" },
    { value: "applied", label: "신청 완료" },
  ];
  return (
    <div role="group" aria-label="보기" className="grid grid-cols-3 gap-1 rounded-control bg-ink-100 p-1">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] text-sm font-bold transition-colors ${
              on ? "bg-surface text-ink-900 shadow-btn-quiet" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            {option.label}
            <span className={on ? "text-brand-700" : "text-ink-500"}>{counts[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** '신청 준비 중' 보기가 비었을 때 — 관심 지원금은 있지만 아직 아무것도 체크하지 않았다 */
function EmptyPreparing({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-brand-200 bg-surface px-5 pb-6 pt-7 text-center">
      <span aria-hidden="true" className="empty-pop flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <ListChecks size={ICON_MD} />
      </span>
      <p className="mt-1 text-base font-bold text-ink-900">아직 준비를 시작한 지원금이 없어요</p>
      <p className="text-sm leading-relaxed text-ink-600">
        관심 지원금을 눌러 체크리스트를 하나라도 체크하면
        <br />
        여기에 모여요
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="press focus-ring mt-3 inline-flex min-h-11 items-center rounded-full bg-surface px-5 text-sm font-bold text-ink-700 shadow-btn-quiet"
      >
        관심 지원금 전체 보기
      </button>
    </div>
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
                <p className="text-[13px] text-ink-500">{policy.agency}</p>
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

/**
 * 신청 완료 카드 (11/23 ggue) — 표시한 날과, 결과를 볼 공식 사이트. 카드를 누르면 정책 상세(표시 취소도 거기서).
 * 신청 준비 진행 막대는 두지 않는다 — 준비는 끝났다.
 */
function AppliedCardItem({ policy, day }: { policy: PolicyMeta; day: string }) {
  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface py-[18px] pl-5 pr-3.5 shadow-card">
      <Link href={`/find/policies/${policy.id}`} className="press focus-ring -m-1 flex items-center gap-2.5 rounded-control p-1">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-ok-50 px-2.5 text-xs font-bold text-ok-700">
            <CircleCheck size={ICON_SM - 2} strokeWidth={2.5} aria-hidden="true" />
            {appliedDayLabel(day)} 신청
          </span>
          <div className="mt-0.5 flex items-center gap-3">
            <Icon3D name={policy.icon} size={40} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-base font-bold leading-snug text-ink-900">{policy.name}</p>
              <p className="text-[13px] text-ink-500">{policy.agency}</p>
            </div>
          </div>
        </div>
        <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
      </Link>
      <a
        href={policy.applyUrl}
        target="_blank"
        rel="noreferrer"
        className="focus-ring inline-flex min-h-11 items-center gap-1.5 self-start rounded-control text-[13px] font-bold text-brand-700 underline underline-offset-[3px]"
        aria-label={`${policy.name} 공식 사이트에서 결과 확인하기 (새 창)`}
      >
        공식 사이트에서 결과 확인하기
        <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
      </a>
    </li>
  );
}

/** '신청 완료' 보기가 비었을 때 */
function EmptyApplied() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-brand-200 bg-surface px-5 pb-6 pt-7 text-center">
      <span aria-hidden="true" className="empty-pop flex size-14 items-center justify-center rounded-full bg-ok-50 text-ok-700">
        <CircleCheck size={ICON_MD} />
      </span>
      <p className="mt-1 text-base font-bold text-ink-900">아직 신청을 마친 지원금이 없어요</p>
      <p className="text-sm leading-relaxed text-ink-600">
        신청 준비 화면에서 ‘신청을 마쳤어요’를 누르면
        <br />
        여기에 모여요
      </p>
    </div>
  );
}

/** 관심 지원금을 모두 신청했을 때 — '전체'가 비었지만 신청 완료는 있다 */
function EmptyAllApplied({ onShowApplied }: { onShowApplied: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-brand-200 bg-surface px-5 pb-6 pt-7 text-center">
      <span aria-hidden="true" className="empty-pop flex size-14 items-center justify-center rounded-full bg-ok-50 text-ok-700">
        <CircleCheck size={ICON_MD} />
      </span>
      <p className="mt-1 text-base font-bold text-ink-900">관심 지원금을 모두 신청했어요</p>
      <div className="mt-3 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onShowApplied}
          className="press focus-ring inline-flex min-h-11 items-center rounded-full bg-surface px-5 text-sm font-bold text-ink-700 shadow-btn-quiet"
        >
          신청 완료 보기
        </button>
        <LinkButton href="/find/policies" variant="text" size="md" full={false}>
          다른 지원금 보러 가기
        </LinkButton>
      </div>
    </div>
  );
}
