"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import noticesData from "@/data/notices.json";
import { AppShell, ContactInfo, DeadlineBadge, StickyBottomAction, TopBar, buttonClass } from "@/app/components";
import { ExternalLink, ICON_SM } from "@/app/components/icons";
import { formatDotDate, seoulTodayISO } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import type { DetailedNotice, NoticeDetail } from "@/lib/notice-detail";
import { noticeDeadlineLabel, noticeStatus, snapshotDateLabel } from "@/lib/notices";

const snapshot = noticesData as { generatedAt: string | null; notices: DetailedNotice[] };

const period = (start: string | null, end: string | null) =>
  [start, end && end !== start ? end : null].filter((d): d is string => Boolean(d)).map(formatDotDate).join(" ~ ");

/**
 * 청약 공고 한 건 (설계 §7). 정적 export 라 [id] 대신 물음표 주소 — 공고가 0건인 날 [id] 는 빌드가 깨진다.
 * 자격은 판정하지 않는다(F0-5). 금액 · 일정은 공고 API 값 그대로, 원문은 아래 버튼.
 */
export default function NoticePage() {
  const [state, setState] = useState<{ today: string; id: string | null } | null>(null);
  useEffect(() => setState({ today: seoulTodayISO(), id: new URLSearchParams(window.location.search).get("id") }), []);

  const notice = state ? snapshot.notices.find((n) => n.id === state.id) : undefined;
  return (
    <AppShell>
      <TopBar backHref="/housing" />
      {state === null ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : !notice || noticeStatus(notice, state.today) === "ended" ? (
        <Gone />
      ) : (
        <Detail notice={notice} today={state.today} />
      )}
    </AppShell>
  );
}

function Gone() {
  return (
    <main className="flex flex-col items-start gap-3 pt-6">
      <p className="text-lg font-bold text-ink-900">끝났거나 내려간 공고예요</p>
      <Link href="/housing" className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-brand-700">
        익산 청약 공고 보기 ›
      </Link>
    </main>
  );
}

function Detail({ notice, today }: { notice: DetailedNotice; today: string }) {
  const d = notice.detail;
  // detail 이 없는 공고(예전 스냅숏)는 접수 기간 한 줄
  const schedule: NoticeDetail["schedule"] = d?.schedule.length
    ? d.schedule
    : notice.applyStart
      ? [{ label: "접수", start: notice.applyStart, end: notice.applyEnd }]
      : [];
  const asOf = snapshotDateLabel(snapshot.generatedAt);
  return (
    <>
      <main className="step-in flex flex-col gap-4 pb-6 pt-1">
        <header className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-[22px] items-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-800">{notice.typeLabel}</span>
            <DeadlineBadge label={noticeDeadlineLabel(notice, today)} />
          </span>
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">{notice.title}</h1>
          {notice.supplier && <p className="text-[13px] text-ink-500">{notice.supplier}</p>}
          <p className="text-[13px] text-ink-500">접수 · {period(notice.applyStart, notice.applyEnd) || "공고문 확인"}</p>
        </header>

        {schedule.length > 0 && (
          <Card label="일정">
            <dl className="flex flex-col">
              {schedule.map((s) => (
                <Row key={s.label} label={s.label} value={period(s.start, s.end)} />
              ))}
            </dl>
          </Card>
        )}

        {d && d.complexes.length > 0 && (
          <Card label="단지">
            <ul className="flex flex-col divide-y divide-ink-100">
              {d.complexes.map((c) => (
                <li key={`${c.name}-${c.address}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-base font-bold text-ink-900">{c.name}</p>
                  <p className="text-[13px] text-ink-500">
                    {[c.address, c.households !== null && `공급 ${c.households.toLocaleString()}호`, c.heating].filter(Boolean).join(" · ")}
                  </p>
                  {c.amounts.length > 0 && (
                    <dl className="mt-1 flex flex-col">
                      {c.amounts.map((a) => (
                        <Row key={a.label} label={a.label} value={formatKoreanMoney(a.won)} />
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
            {d.complexes.some((c) => c.amounts.length > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                <b className="font-bold text-ink-700">가장 낮은 조건 기준이에요.</b> 내 조건의 금액은 공고문에서 확인해 주세요.
              </p>
            )}
          </Card>
        )}

        {d?.houseTypes && d.houseTypes.length > 0 && (
          <Card label="주택형별 공급금액">
            <table aria-label="주택형별 공급금액" className="w-full text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr>
                  <th scope="col" className="pb-2 pr-3 font-medium">주택형</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">일반 · 특별</th>
                  <th scope="col" className="pb-2 text-right font-medium">최고 공급금액</th>
                </tr>
              </thead>
              <tbody>
                {d.houseTypes.map((t) => (
                  <tr key={t.type} className="border-t border-ink-100">
                    <td className="whitespace-nowrap py-2 pr-3 font-bold text-ink-900">{t.type}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-ink-600">{`${t.general} · ${t.special}세대`}</td>
                    <td className="whitespace-nowrap py-2 text-right font-bold text-ink-900">{t.topPrice === null ? "공고문 확인" : formatKoreanMoney(t.topPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">주택형은 전용면적, 금액은 청약홈 공급금액의 최고가 기준이에요. 같은 주택형도 층 · 동에 따라 달라요.</p>
          </Card>
        )}

        {d && d.facts.length > 0 && (
          <Card label="개요">
            <dl className="flex flex-col">
              {d.facts.map((f) => (
                <Row key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
          </Card>
        )}

        <ContactInfo contact={d?.contact ? { ...d.contact, phoneCheckedAt: null } : null} variant="block" />

        <p className="rounded-control bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600">
          자격과 소득 기준은 공고마다 달라요. 꼭 공고문에서 확인해 주세요.
          <br />
          출처: {notice.source}{asOf ? ` · ${asOf} 기준` : ""}
        </p>
      </main>
      <StickyBottomAction>
        <a href={notice.url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "primary", size: "screen" })}>
          공고문 보기
          <ExternalLink size={ICON_SM} aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      </StickyBottomAction>
    </>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="mb-2 text-sm font-bold text-ink-900">{label}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <dt className="shrink-0 text-[13px] text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
