import policiesJson from "@/data/policies.json";
import type { BadgeFacts } from "./badges";
import { GUIDES } from "./guides";
import { addMonths, ledgerMonth, ledgerPlan, ledgerProgress, type LedgerPlan, type LedgerRecord, type MonthKey } from "./ledger";
import { pageProgress } from "./preparation";
import { policiesForRegion } from "./region";
import {
  loadChecklist,
  loadDocumentChecks,
  loadGuidesRead,
  loadLedger,
  loadListing,
  loadProfile,
  loadSaved,
} from "./storage";
import { buildCalculationSummary } from "./summary";
import type { PolicyMeta } from "./types";

const POLICIES = policiesJson as PolicyMeta[];

/**
 * 배지 판정 재료를 이 기기 기록에서 모은다 (내 프로필 설계 §7). 판정 자체는 lib/badges.ts.
 * 달력 '그 달 다 적음'은 달력 화면과 같은 계산(계약 조건 + 자격 답 → 계획)으로 본다 — 계산이 없으면 연속 0.
 */
export function readBadgeFacts(todayISO: string): BadgeFacts {
  const listing = loadListing();
  const profile = loadProfile();
  const ledger = loadLedger();

  let prepStarted = false;
  let prepBest: BadgeFacts["prepBest"] = null;
  for (const policy of POLICIES) {
    const { done, total } = pageProgress(policy, loadChecklist(policy.id), loadDocumentChecks(policy.id));
    if (done > 0) prepStarted = true;
    if (total > 0 && (prepBest === null || done / total > prepBest.done / prepBest.total)) prepBest = { done, total };
  }
  if (!prepStarted) prepBest = prepBest && { ...prepBest, done: 0 };

  let plan: LedgerPlan | null = null;
  if (listing && profile) {
    try {
      const summary = buildCalculationSummary(policiesForRegion(POLICIES, listing.region), profile, listing, todayISO);
      plan = ledgerPlan(listing, summary, profile.birthDate);
    } catch {
      plan = null;
    }
  }

  return {
    calculated: listing !== null && profile !== null,
    saved: loadSaved().length,
    prepStarted,
    prepBest,
    guidesRead: loadGuidesRead().length,
    guidesTotal: GUIDES.length,
    ledgerAny: Object.values(ledger.months).some((m) => Object.keys(m.done).length > 0),
    ledgerStreak: plan ? longestCompleteStreak(plan, ledger) : 0,
  };
}

/** '그 달 칸을 다 체크한 달'이 가장 길게 이어진 수 */
export function longestCompleteStreak(plan: LedgerPlan, record: LedgerRecord): number {
  const months = Object.keys(record.months).sort();
  const complete = new Set<MonthKey>(months.filter((m) => ledgerProgress(ledgerMonth(plan, record, m))?.complete === true));
  let best = 0;
  for (const m of complete) {
    if (complete.has(addMonths(m, -1))) continue; // 이어지는 줄의 첫 달에서만 센다
    let run = 1;
    while (complete.has(addMonths(m, run))) run++;
    best = Math.max(best, run);
  }
  return best;
}
