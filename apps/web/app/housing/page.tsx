"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import noticesData from "@/data/notices.json";
import { AppShell, TopBar } from "@/app/components";
import { seoulTodayISO } from "@/lib/date";
import { groupNotices, kindsPresent, snapshotDateLabel, type NoticeKind, type NoticeSnapshot } from "@/lib/notices";
import { NoticeCard } from "./NoticeCard";

const snapshot = noticesData as NoticeSnapshot;

/**
 * 익산 청약 공고 (docs/기획/2026-11-22-청약-공고-설계.md §2). 로그인 없이 열린다.
 * 날짜는 브라우저에서 — 정적 export 라 빌드 날짜가 박히면 안 된다(PRODUCT.md). 끝난 공고는 보는 날로 다시 거른다.
 */
export default function HousingPage() {
  const [today, setToday] = useState<string | null>(null);
  const [kind, setKind] = useState<NoticeKind | null>(null);
  useEffect(() => setToday(seoulTodayISO()), []);

  const asOf = snapshotDateLabel(snapshot.generatedAt);
  return (
    <AppShell>
      <TopBar backHref="/home" />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">익산 청약 공고</h1>
          <p className="text-[15px] text-ink-600">공공임대 · 공공분양 · 아파트 분양{asOf ? ` · ${asOf} 기준` : ""}</p>
        </header>
        {today === null ? (
          <p className="mt-6 text-center text-sm text-ink-500">불러오는 중…</p>
        ) : (
          <Body today={today} kind={kind} onKind={setKind} />
        )}
        <p className="rounded-control bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600">
          자격과 소득 기준은 공고마다 달라요. 꼭 공고문에서 확인해 주세요.
          <br />
          출처: 마이홈포털 · 청약홈 (매일 아침 갱신)
        </p>
      </main>
    </AppShell>
  );
}

function Body({ today, kind, onKind }: { today: string; kind: NoticeKind | null; onKind: (k: NoticeKind | null) => void }) {
  const kinds = kindsPresent(snapshot.notices, today);
  const { open, upcoming } = groupNotices(snapshot.notices, today, kind);
  if (snapshot.generatedAt === null) {
    // 빌드 때 못 받아 빈 스냅숏으로 배포된 날 — '없음'이 아니라 '모름'이다 (리뷰 I-2)
    return (
      <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-card">
        <p className="text-base font-bold text-ink-900">공고를 아직 불러오지 못했어요</p>
        <p className="text-sm text-ink-600">잠시 뒤 다시 확인하거나, 마이홈포털에서 익산 공고를 봐 주세요.</p>
        <a href="https://www.myhome.go.kr/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-700">
          마이홈포털에서 보기 ›
        </a>
      </div>
    );
  }
  if (kinds.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-5 shadow-card">
        <p className="text-base font-bold text-ink-900">지금 익산에 접수 중인 청약 공고가 없어요</p>
        <Link href="/guides/cheongyak" className="text-sm font-bold text-brand-700">청약 쉽게 알아보기 ›</Link>
      </div>
    );
  }
  return (
    <>
      <div role="group" aria-label="공고 종류" className="flex flex-wrap gap-2">
        {[null, ...kinds].map((k) => (
          <button
            key={k ?? "전체"}
            type="button"
            aria-pressed={kind === k}
            onClick={() => onKind(k)}
            className={`focus-ring min-h-11 rounded-full px-4 text-sm font-bold ${kind === k ? "bg-brand-600 text-white" : "bg-surface text-ink-700 shadow-card"}`}
          >
            {k ?? "전체"}
          </button>
        ))}
      </div>
      {[
        { title: "접수 중", list: open },
        { title: "접수 예정", list: upcoming },
      ].map(({ title, list }) =>
        list.length === 0 ? null : (
          <section key={title} aria-label={`${title} ${list.length}`} className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-ink-700">
              {title} {list.length}
            </h2>
            <ul className="flex flex-col gap-3">
              {list.map((notice) => (
                <li key={notice.id}>
                  <NoticeCard notice={notice} today={today} />
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </>
  );
}
