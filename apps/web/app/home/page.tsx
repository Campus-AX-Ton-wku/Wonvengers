"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, LinkButton, TopBar } from "@/app/components";
import { ChevronRight, ICON_SM } from "@/app/components/icons";
import { resolveAnswers } from "@/lib/age";
import { hasStoredLogin, isLoginAvailable } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { answerLine } from "@/lib/discovery";
import { availableCount, savedCards } from "@/lib/home";
import { formatKoreanMoney } from "@/lib/money";
import { replacePage } from "@/lib/redirect";
import { policiesForRegion } from "@/lib/region";
import { EMPTY_ANSWERS, loadAnswers, loadChecklist, loadDocumentChecks, loadListing, loadProfile, loadSaved, onLocalChange } from "@/lib/storage";
import { buildCalculationSummary } from "@/lib/summary";
import type { DiscoveryAnswers, PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * 홈 — 내 주거지원 현황 (docs/기획/2026-11-17-홈-찜하기-설계.md "2"). 로그인한 사람만.
 * 순서: 제목 + 내 조건(D) → 내 지원 요약(B) → 찜한 지원금(A).
 */
export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [saved, setSaved] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [costs, setCosts] = useState<{ nominal: number; final: number } | null>(null);

  useEffect(() => {
    if (!isLoginAvailable() || !hasStoredLogin()) {
      replacePage("/onboarding");
      return;
    }
    const read = () => {
      const t = seoulTodayISO();
      setToday(t);
      setAnswers(loadAnswers());
      setSaved(loadSaved());
      const listing = loadListing();
      const profile = loadProfile();
      if (listing && profile) {
        try {
          const s = buildCalculationSummary(policiesForRegion(policies, listing.region), profile, listing, t);
          setCosts({ nominal: s.nominalTotalCost, final: s.finalEstimatedHousingCost });
        } catch {
          setCosts(null);
        }
      } else setCosts(null);
      setReady(true);
    };
    read();
    return onLocalChange(read);
  }, []);

  if (!ready) return <AppShell><TopBar /><p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p></AppShell>;

  const count = availableCount(policies, answers, today);
  const cards = savedCards(policies, saved, today, { checklist: loadChecklist, documents: loadDocumentChecks });

  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-col gap-6 pb-10 pt-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">내 주거지원 현황</h1>
          {count !== null && (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-ink-500">{answerLine(resolveAnswers(answers, today))}</p>
              <Link href="/find" className="focus-ring flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-bold text-brand-700">
                조건 수정 <ChevronRight size={ICON_SM} aria-hidden="true" />
              </Link>
            </div>
          )}
        </header>

        <section aria-label="내 지원 요약" className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
          {count === null ? (
            <>
              <p className="text-base font-bold text-ink-900">질문에 답하면 받을 수 있는 지원금을 찾아 드려요</p>
              <LinkButton href="/find" size="screen" full>시작하기</LinkButton>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-ink-900">지금 받을 수 있는 지원금 {count}건</p>
                <Link href="/find/policies" className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-brand-700">목록 보기</Link>
              </div>
              {costs ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-700">지원받으면 {formatKoreanMoney(costs.nominal)} → <strong className="text-accent-600">{formatKoreanMoney(costs.final)}</strong></p>
                  <Link href="/result" className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-brand-700">결과 보기</Link>
                </div>
              ) : (
                <Link href="/calculate" className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-brand-700">내 월세 계산하기</Link>
              )}
            </>
          )}
        </section>

        <section aria-label="찜한 지원금" className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-ink-900">찜한 지원금</h2>
          {cards.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-card bg-ink-50 p-5">
              <p className="text-sm text-ink-600">아직 찜한 지원금이 없어요</p>
              <Link href="/find/policies" className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-brand-700">지원금 찾기</Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cards.map(({ policy, deadline, progress }) => (
                <li key={policy.id}>
                  <Link href={`/find/policies/${policy.id}/prepare`} className="focus-ring block rounded-card bg-surface p-5 shadow-card">
                    <p className="text-base font-bold text-ink-900">{policy.name}</p>
                    <p className="mt-1 text-sm text-ink-500">{policy.agency}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-bold text-brand-700">{progress}</span>
                      <span className="text-ink-600">{deadline}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
