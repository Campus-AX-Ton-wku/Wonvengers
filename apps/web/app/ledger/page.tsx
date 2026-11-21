"use client";

import { useCallback, useEffect, useState } from "react";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, Icon3D, LinkButton, TopBar } from "@/app/components";
import { ChevronRight, ICON_MD, ICON_SM, Info } from "@/app/components/icons";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { ledgerPlan, monthKeyOf, oneTimeSupports, type LedgerPlan, type LedgerRecord, type MonthKey, type OneTimeSupport } from "@/lib/ledger";
import { replacePage } from "@/lib/redirect";
import { policiesForRegion } from "@/lib/region";
import { loadLedger, loadListing, loadProfile, onLocalChange, saveLedger } from "@/lib/storage";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { MonthSection } from "./MonthSection";
import { OneTimeSection } from "./OneTimeSection";

const policies = policiesJson as PolicyMeta[];

type Calculated = { plan: LedgerPlan; oneTime: OneTimeSupport[] };

/**
 * 주거비 달력 — 계산한 값이 미리 적힌 체크표 (docs/기획/2026-11-21-주거비-달력-설계.md, 하단 섬 '달력' 탭).
 * 로그인한 사람만(관심 화면과 같은 방식). 기록은 이 기기에만(lib/storage.ts loadLedger · saveLedger).
 * 보고 있는 달은 화면 상태로만 둔다 — 주소에 남기면 뒤로 가기가 달을 하나씩 되짚는다.
 * 같은 탭에서 계산값이 바뀌면(onLocalChange) 계획을 다시 만든다. 서버 값 받기는 조용히 저장하고 화면을 다시 불러오므로 여기까지 오지 않는다.
 * 다른 탭의 변경은 storage 이벤트로 듣는다 — 기록(perky.ledger)은 다시 읽고, 계산값(listing · profile)은 계획을 다시 만든다.
 * 안 그러면 이 탭에서 누른 순간 낡은 기록으로 덮어써 다른 탭의 기록을 잃는다.
 */
export default function LedgerPage() {
  const [ready, setReady] = useState(false);
  const [calc, setCalc] = useState<Calculated | null>(null);
  const [record, setRecord] = useState<LedgerRecord | null>(null);
  const [todayMonth, setTodayMonth] = useState<MonthKey>("");
  const [month, setMonth] = useState<MonthKey>("");

  useEffect(() => {
    const leave = () => replacePage("/onboarding");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    const read = () => {
      const today = seoulTodayISO();
      const listing = loadListing();
      const profile = loadProfile();
      let next: Calculated | null = null;
      if (listing && profile) {
        try {
          const summary = buildCalculationSummary(policiesForRegion(policies, listing.region), profile, listing, today);
          next = { plan: ledgerPlan(listing, summary, profile.birthDate), oneTime: oneTimeSupports(summary) };
        } catch {
          next = null;
        }
      }
      setCalc(next);
      setRecord(loadLedger());
      setTodayMonth(monthKeyOf(today));
      setMonth((current) => current || monthKeyOf(today));
      setReady(true);
    };
    read();
    const checkLogin = () => {
      if (!hasStoredLogin()) leave();
    };
    // 다른 탭의 로그아웃은 lib/auth.ts 의 알림이 오지 않는다 — 브라우저의 storage 이벤트로 듣는다 (관심 화면과 같다).
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY || event.key === null) checkLogin();
      else if (event.key === "perky.ledger") setRecord(loadLedger());
      else if (event.key === "housing-benefit:listing" || event.key === "housing-benefit:profile") read();
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

  const update = useCallback((next: LedgerRecord) => {
    setRecord(next);
    saveLedger(next);
  }, []);

  if (!ready || record === null) {
    return (
      <AppShell>
        <TopBar />
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar />
      <main className="flex flex-col pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">주거비 달력</h1>
        {calc === null ? (
          <BeforeCalculation />
        ) : (
          <>
            <p className="mt-1.5 text-sm leading-normal text-ink-600">계산한 값을 미리 채워 뒀어요. 내고 받을 때 눌러 주세요.</p>
            <MonthSection plan={calc.plan} record={record} month={month} todayMonth={todayMonth} onMonth={setMonth} onChange={update} />
            <OneTimeSection supports={calc.oneTime} record={record} month={month} todayMonth={todayMonth} onChange={update} />
            <p className="mt-5 flex items-start gap-1.5 text-[13px] leading-normal text-ink-500">
              <Info size={ICON_SM} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>기록은 이 기기에만 저장돼요. 로그아웃하면 지워져요.</span>
            </p>
          </>
        )}
      </main>
      <BottomTabBar active="ledger" />
    </AppShell>
  );
}

/** 계산 전 (시안 '계산 전') — 달력은 계산값이 있어야 미리 채운다. */
function BeforeCalculation() {
  return (
    <section aria-label="계산 전" className="mt-4 flex flex-col items-center gap-3 rounded-card bg-surface px-[22px] pb-[22px] pt-8 text-center shadow-card">
      <Icon3D name="calculator" size={64} />
      <h2 className="text-xl font-extrabold leading-snug text-ink-900">먼저 내 월세를 계산해요</h2>
      <p className="text-sm leading-relaxed text-ink-600">
        보증금·월세·관리비를 넣으면
        <br />
        달마다 낼 돈과 받을 지원을 미리 채워 둘게요.
      </p>
      <LinkButton href="/calculate" variant="primary" size="screen" full className="mt-1.5">
        계산하기
        <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="-ml-1" />
      </LinkButton>
    </section>
  );
}
