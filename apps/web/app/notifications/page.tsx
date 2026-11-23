"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import noticesData from "@/data/notices.json";
import policiesJson from "@/data/policies.json";
import { AppShell, DeadlineBadge, Icon3D, IconLink, TabIcon, TopBar } from "@/app/components";
import { ChevronRight, ICON_LG, ICON_MD, Settings } from "@/app/components/icons";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { formatDotDate, seoulTodayISO } from "@/lib/date";
import { inboxItems, loadInboxSeen, markInboxSeen, noticeInboxItems, seoulDateOf, type InboxItem, type NoticeInboxItem } from "@/lib/inbox";
import { noticeHref } from "@/lib/notice-detail";
import { noticeDeadlineLabel, type NoticeSnapshot } from "@/lib/notices";
import { deadlineLabel } from "@/lib/preparation";
import { isPushConfigured } from "@/lib/push";
import { replacePage } from "@/lib/redirect";
import { loadAnswers, loadChecklist, loadDocumentChecks, loadSaved } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];
const notices = (noticesData as NoticeSnapshot).notices;

const SECTIONS: { kind: InboxItem["kind"]; title: string }[] = [
  { kind: "deadline", title: "마감이 다가와요" },
  { kind: "upcoming", title: "곧 신청이 열려요" },
  { kind: "new", title: "새 지원금이 올라왔어요" },
  { kind: "opened", title: "새로 신청이 열렸어요" },
];

/**
 * 알림함 (상단바 종, 11/20). 무엇을 모으는지는 lib/inbox.ts 머리말.
 * 처음 그릴 때 '새로'였던 항목을 기억해 두고 점을 찍은 뒤, 모두 읽음으로 바꾼다 — 그래서 상단바 종의 점이 꺼진다.
 * 탭의 첫 화면이 아니라 종에서 들어오는 화면이라 하단 섬은 두지 않는다.
 */
export default function NotificationsPage() {
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [noticeItems, setNoticeItems] = useState<NoticeInboxItem[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const leave = () => replacePage("/onboarding");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    const t = seoulTodayISO();
    const answers = loadAnswers();
    const list = inboxItems(policies, answers, loadSaved(), t, { checklist: loadChecklist, documents: loadDocumentChecks });
    const noticeList = noticeInboxItems(notices, answers, t);
    const seen = loadInboxSeen();
    setToday(t);
    setItems(list);
    setNoticeItems(noticeList);
    setFresh(new Set([...list, ...noticeList].filter((item) => !seen.has(item.key)).map((item) => item.key)));
    setReady(true);
    markInboxSeen([...list, ...noticeList]);

    const checkLogin = () => {
      if (!hasStoredLogin()) leave();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY || event.key === null) checkLogin();
    };
    window.addEventListener("storage", onStorage);
    const offAuth = onAuthChange(checkLogin);
    return () => {
      window.removeEventListener("storage", onStorage);
      offAuth();
    };
  }, []);

  return (
    <AppShell>
      {/* 오른쪽 위 ⚙ → 알림 설정 (11/20 두 단계 구조 — 당근 · 토스처럼 알림함 안에서 설정으로). 예전에는 맨 아래
          '폰으로도 알림 받기 · 알림 설정' 이 내 정보(/account#notifications)로 보냈다. 이 화면에 종은 두지 않는다 — 여기가 알림함이다 */}
      <TopBar
        backHref="/home"
        right={
          isPushConfigured() ? (
            <IconLink href="/notifications/settings" label="알림 설정">
              <Settings size={ICON_LG} aria-hidden="true" />
            </IconLink>
          ) : (
            <span className="w-11" aria-hidden="true" />
          )
        }
      />
      <main className="flex flex-col gap-6 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">알림</h1>
        {!ready ? (
          <p className="mt-6 text-center text-sm text-ink-500">불러오는 중…</p>
        ) : items.length === 0 && noticeItems.length === 0 ? (
          <EmptyInbox />
        ) : (
          <>
          {SECTIONS.map(({ kind, title }) => {
            const list = items.filter((item) => item.kind === kind);
            if (list.length === 0) return null;
            return (
              <section key={kind} aria-label={title} className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-ink-700">{title}</h2>
                <ul className="flex flex-col gap-3">
                  {list.map((item) => (
                    <InboxRow key={item.key} item={item} today={today} fresh={fresh.has(item.key)} />
                  ))}
                </ul>
              </section>
            );
          })}
            {noticeItems.length > 0 && (
              <section aria-label="새 청약 공고가 올라왔어요" className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-ink-700">새 청약 공고가 올라왔어요</h2>
                <ul className="flex flex-col gap-3">
                  {noticeItems.map((item) => (
                    <NoticeInboxRow key={item.key} item={item} today={today} fresh={fresh.has(item.key)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

function subline(item: InboxItem): string {
  switch (item.kind) {
    case "deadline":
      return `관심 지원금 · ${item.card.progress.label}`;
    case "upcoming":
      return `관심 지원금 · ${formatDotDate(item.policy.applicationStart)} 신청 시작`;
    case "new": {
      // 휴대폰 새 정책 알림과 같은 말 — '가능성 있음'이면 맞을 가능성, '확인 필요'면 확인
      const [, m, d] = seoulDateOf(item.policy.publishedAt ?? "").split("-");
      return `${Number(m)}월 ${Number(d)}일 등록 · ${item.tag === "가능성 있음" ? "조건에 맞을 가능성이 있어요" : "조건을 확인해 보세요"}`;
    }
    case "opened":
      return `${item.policy.agency} · ${formatDotDate(item.policy.applicationStart)}부터 신청`;
  }
}

function InboxRow({ item, today, fresh }: { item: InboxItem; today: string; fresh: boolean }) {
  const { policy } = item;
  // 마감이 다가오는 찜은 준비 화면으로 — 할 일이 거기 있다. 나머지는 정책 자세히.
  const href = item.kind === "deadline" ? `/find/policies/${policy.id}/prepare` : `/find/policies/${policy.id}`;
  return (
    <li>
      <Link href={href} className="press focus-ring flex items-center gap-3 rounded-card bg-surface py-4 pl-4 pr-3 shadow-card">
        <Icon3D name={policy.icon} size={40} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="flex items-center gap-1.5">
            <DeadlineBadge label={deadlineLabel(policy, today)} />
            {fresh && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
                새 소식
              </span>
            )}
          </span>
          <span className="text-[15px] font-bold leading-snug text-ink-900">{policy.name}</span>
          <span className="text-[13px] text-ink-500">{subline(item)}</span>
        </span>
        <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
      </Link>
    </li>
  );
}

function NoticeInboxRow({ item, today, fresh }: { item: NoticeInboxItem; today: string; fresh: boolean }) {
  const { notice } = item;
  const [, m, d] = (notice.announcedAt ?? "").split("-");
  return (
    <li>
      <Link href={noticeHref(notice.id)} className="focus-ring flex items-center gap-3 rounded-card bg-surface py-4 pl-4 pr-3 shadow-card">
        <Icon3D name="bankbook" size={40} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="flex items-center gap-1.5">
            <DeadlineBadge label={noticeDeadlineLabel(notice, today)} />
            {fresh && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
                새 소식
              </span>
            )}
          </span>
          <span className="text-[15px] font-bold leading-snug text-ink-900">{notice.title}</span>
          <span className="text-[13px] text-ink-500">{`${notice.typeLabel} · ${Number(m)}월 ${Number(d)}일 공고`}</span>
        </span>
        <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
      </Link>
    </li>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center shadow-card">
      <span aria-hidden="true" className="empty-pop flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <TabIcon name="bell" />
      </span>
      <p className="text-base font-bold text-ink-900">새 소식이 없어요</p>
      <p className="text-sm leading-relaxed text-ink-600">
        관심 지원금 마감이 7일 안으로 다가오거나
        <br />
        내 조건에 맞는 지원금이 새로 열리면 여기에 모아 드려요.
      </p>
    </div>
  );
}
