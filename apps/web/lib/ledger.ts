import { monthlyBreakdown } from "./benefit";
import { formatKoreanMoney } from "./money";
import type { CalculationSummary, ContractType, ListingInput, PolicyMeta } from "./types";

/**
 * 주거비 달력 (docs/기획/2026-11-21-주거비-달력-설계.md §4 · §5).
 *
 * 계산할 때 넣은 계약 조건과 결과 화면의 지원 조합으로 달마다 낼 돈 · 받을 지원을 미리 적는다(계획, LedgerPlan).
 * 사람이 한 일 — 누른 칸(누를 때 금액) · 고친 금액 · 한 번 받는 지원의 받은 달 — 만 기록(LedgerRecord)으로 남기고,
 * 화면 값은 열 때마다 계획 + 기록으로 다시 센다. 그래서 다시 계산하면 안 누른 칸만 저절로 새 값이 된다(결정 ⑤).
 * 이 파일은 저장소를 모른다(순수 함수). 읽고 쓰기는 lib/storage.ts 의 loadLedger · saveLedger.
 */

/** "2026-11" */
export type MonthKey = string;

export interface LedgerMonthRecord {
  /** 누른 칸 → 누를 때의 금액(원). 다시 계산해도 누른 칸 금액은 그대로 둔다. */
  done: Record<string, number>;
  /** 고친 칸 → 고친 금액(원). 이 달에만. */
  amounts: Record<string, number>;
}

export interface LedgerRecord {
  v: 1;
  months: Record<MonthKey, LedgerMonthRecord>;
  /** 한 번 받는 지원: 정책 id → 받은 달 */
  oneTime: Record<string, MonthKey>;
}

export function emptyLedger(): LedgerRecord {
  return { v: 1, months: {}, oneTime: {} };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function positiveAmounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) out[key] = Math.round(value);
  }
  return out;
}

/** 저장소에서 읽은 값을 기록으로. 모양이 틀린 부분은 버린다(다른 저장값처럼 조용히). */
export function parseLedger(raw: unknown): LedgerRecord {
  const out = emptyLedger();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { v?: unknown; months?: unknown; oneTime?: unknown };
  if (r.v !== 1) return out;
  if (r.months && typeof r.months === "object") {
    for (const [month, value] of Object.entries(r.months as Record<string, unknown>)) {
      if (!MONTH_RE.test(month) || !value || typeof value !== "object") continue;
      const m = value as { done?: unknown; amounts?: unknown };
      out.months[month] = { done: positiveAmounts(m.done), amounts: positiveAmounts(m.amounts) };
    }
  }
  if (r.oneTime && typeof r.oneTime === "object") {
    for (const [id, month] of Object.entries(r.oneTime as Record<string, unknown>)) {
      if (typeof month === "string" && MONTH_RE.test(month)) out.oneTime[id] = month;
    }
  }
  return out;
}

// ── 달 ──

export function monthKeyOf(iso: string): MonthKey {
  return iso.slice(0, 7);
}

function toIndex(key: MonthKey): number {
  return Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
}

function fromIndex(index: number): MonthKey {
  const year = Math.floor(index / 12);
  return `${year}-${String(index - year * 12 + 1).padStart(2, "0")}`;
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  return fromIndex(toIndex(key) + n);
}

/** to − from (개월). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  return toIndex(to) - toIndex(from);
}

/** "2026년 11월" */
export function monthLabel(key: MonthKey): string {
  return `${Number(key.slice(0, 4))}년 ${Number(key.slice(5, 7))}월`;
}

/** "11월" */
export function monthOnlyLabel(key: MonthKey): string {
  return `${Number(key.slice(5, 7))}월`;
}

/** 한 번 받는 지원의 "10월에 받음" — 해가 다르면 "2025년 12월". */
export function receivedMonthLabel(month: MonthKey, todayMonth: MonthKey): string {
  return month.slice(0, 4) === todayMonth.slice(0, 4) ? monthOnlyLabel(month) : monthLabel(month);
}

/** 합계 이름 — 이번 달이 아닌 달을 보면 '이번 달'이라 하지 않고 그 달 이름을 쓴다. */
export function burdenLabel(month: MonthKey, todayMonth: MonthKey): string {
  return month === todayMonth ? "이번 달 실제 부담" : `${receivedMonthLabel(month, todayMonth)} 실제 부담`;
}

/** 보고 있는 달이 올해가 아니면 '올해'라고 하지 않는다 — 2027년 1월을 보며 '올해'라면 2026년으로 읽힌다. */
export function yearTotalLabel(month: MonthKey, todayMonth: MonthKey): string {
  return month.slice(0, 4) === todayMonth.slice(0, 4) ? "올해 누적" : `${Number(month.slice(0, 4))}년 누적`;
}

// ── 계획 ──

export const RENT_KEY = "rent";
export const FEE_KEY = "fee";

export function policyLineKey(id: string): string {
  return `policy:${id}`;
}

export interface LedgerIncome {
  policy: PolicyMeta;
  monthly: number;
  /** 계약 1개월째부터 이 개월째까지 들어온다 */
  months: number;
}

export interface LedgerPlan {
  start: MonthKey;
  end: MonthKey;
  months: number;
  contractType: ContractType;
  /** 월세 또는 연세 */
  rent: number;
  fee: number;
  incomes: LedgerIncome[];
}

/** 들어오는 돈 = 결과 합계(최선 조합)에 든 월 지원. 일시금은 따로(oneTimeSupports). */
export function ledgerPlan(listing: ListingInput, summary: CalculationSummary, birthDate?: string): LedgerPlan {
  const start = monthKeyOf(listing.contractStartDate);
  const months = Math.max(1, listing.months);
  const included = new Set(summary.bestCombination.includedPolicyIds);
  const incomes: LedgerIncome[] = [];
  for (const result of summary.results) {
    if (!included.has(result.policy.id)) continue;
    const breakdown = monthlyBreakdown(result.policy, listing, birthDate);
    if (breakdown && breakdown.monthly > 0) incomes.push({ policy: result.policy, monthly: breakdown.monthly, months: breakdown.months });
  }
  return {
    start,
    end: addMonths(start, months - 1),
    months,
    contractType: listing.contractType,
    rent: listing.rentOrYearlyAmount,
    fee: listing.managementFee,
    incomes,
  };
}

// ── 한 달 ──

export interface LedgerLine {
  key: string;
  side: "out" | "in";
  label: string;
  /** 연세 줄의 보조문 */
  note: string | null;
  /** 지금 계산값 */
  planned: number;
  /** 화면 금액 = 고친 값 → 누를 때 금액 → 계산값 */
  amount: number;
  edited: boolean;
  done: boolean;
}

export interface LedgerMonthView {
  month: MonthKey;
  inContract: boolean;
  /** 계약 N개월째 (기간 밖이면 1 미만이거나 months 초과) */
  contractMonth: number;
  lines: LedgerLine[];
  /** 누른 나가는 돈 − 누른 들어오는 돈. 음수 그대로. */
  actual: number;
  /** 모든 칸을 계산값으로 다 눌렀을 때. 고친 값은 넣지 않는다. 음수 그대로. */
  expected: number;
  /** 안 누른 칸이 있다 */
  pending: boolean;
  /** 그 해 1월 ~ 이 달의 actual 합. 음수 그대로. */
  yearTotal: number;
}

function linesFor(plan: LedgerPlan, record: LedgerRecord, month: MonthKey): LedgerLine[] {
  const n = monthsBetween(plan.start, month) + 1;
  if (n < 1 || n > plan.months) return [];
  const pressed = record.months[month]?.done ?? {};
  const amounts = record.months[month]?.amounts ?? {};
  const line = (key: string, side: LedgerLine["side"], label: string, planned: number, note: string | null = null): LedgerLine => {
    const edited = amounts[key] !== undefined;
    const done = pressed[key] !== undefined;
    return { key, side, label, note, planned, amount: edited ? amounts[key] : done ? pressed[key] : planned, edited, done };
  };
  const lines: LedgerLine[] = [];
  if (plan.contractType === "연세") {
    if (n === 1 && plan.rent > 0) lines.push(line(RENT_KEY, "out", "연세", plan.rent, "연세는 계약 시작 달에 한 번만 나와요"));
  } else if (plan.rent > 0) {
    lines.push(line(RENT_KEY, "out", "월세", plan.rent));
  }
  if (plan.fee > 0) lines.push(line(FEE_KEY, "out", "관리비", plan.fee));
  for (const income of plan.incomes) {
    if (n <= income.months) lines.push(line(policyLineKey(income.policy.id), "in", income.policy.name, income.monthly));
  }
  return lines;
}

const sign = (l: LedgerLine) => (l.side === "out" ? 1 : -1);

function actualOf(lines: LedgerLine[]): number {
  return lines.reduce((sum, l) => (l.done ? sum + sign(l) * l.amount : sum), 0);
}

export function ledgerMonth(plan: LedgerPlan, record: LedgerRecord, month: MonthKey): LedgerMonthView {
  const contractMonth = monthsBetween(plan.start, month) + 1;
  const lines = linesFor(plan, record, month);
  let yearTotal = 0;
  for (let m = `${month.slice(0, 4)}-01`; monthsBetween(m, month) >= 0; m = addMonths(m, 1)) {
    yearTotal += actualOf(linesFor(plan, record, m));
  }
  return {
    month,
    inContract: contractMonth >= 1 && contractMonth <= plan.months,
    contractMonth,
    lines,
    actual: actualOf(lines),
    expected: lines.reduce((sum, l) => sum + sign(l) * l.planned, 0),
    pending: lines.some((l) => !l.done),
    yearTotal,
  };
}

// ── 기록 바꾸기 (원래 기록은 그대로 두고 새 기록을 돌려준다) ──

function withMonth(record: LedgerRecord, month: MonthKey, edit: (m: LedgerMonthRecord) => LedgerMonthRecord): LedgerRecord {
  const current = record.months[month] ?? { done: {}, amounts: {} };
  return { ...record, months: { ...record.months, [month]: edit(current) } };
}

/** 누르면 그때 금액을 남기고, 다시 누르면 지운다. */
export function toggleLine(record: LedgerRecord, month: MonthKey, key: string, amount: number): LedgerRecord {
  return withMonth(record, month, (m) => {
    const done = { ...m.done };
    if (done[key] !== undefined) delete done[key];
    else done[key] = Math.round(amount);
    return { ...m, done };
  });
}

/**
 * 이 달 이 칸의 금액을 고친다. 비우거나(null · 0 이하) 계산값과 같으면 고친 값을 지운다(= [계산값으로]).
 * 이미 누른 칸이면 누른 금액도 새 금액으로 따라간다 — 안 그러면 [계산값으로] 뒤에도 고친 금액이 남는다.
 */
export function setLineAmount(
  record: LedgerRecord,
  month: MonthKey,
  line: Pick<LedgerLine, "key" | "planned">,
  won: number | null
): LedgerRecord {
  return withMonth(record, month, (m) => {
    const value = won !== null && won > 0 && Math.round(won) !== line.planned ? Math.round(won) : null;
    const amounts = { ...m.amounts };
    if (value === null) delete amounts[line.key];
    else amounts[line.key] = value;
    const done = { ...m.done };
    if (done[line.key] !== undefined) done[line.key] = value ?? line.planned;
    return { done, amounts };
  });
}

/** 한 번 받는 지원 — 누르면 받은 달을 남기고, 다시 누르면 지운다. */
export function toggleOneTime(record: LedgerRecord, policyId: string, month: MonthKey): LedgerRecord {
  const oneTime = { ...record.oneTime };
  if (oneTime[policyId] !== undefined) delete oneTime[policyId];
  else oneTime[policyId] = month;
  return { ...record, oneTime };
}

// ── 한 번 받는 지원 ──

export interface OneTimeSupport {
  policy: PolicyMeta;
  /** "10만원" · "최대 50만원". 공고 금액이 없으면 null (추정 금지) */
  amountText: string | null;
  /** 결과 화면의 판정 — 조건충족시가능이면 달력에서 '확인 필요' 태그 */
  status: "예상적용" | "조건충족시가능";
}

/**
 * 결과에서 받을 수 있다고 나온 일시금 전부(가능성 있음 · 확인 필요). 결과 합계 기준이 아니다(ggue 11/21) —
 * 이사비 칸이 빠지면(d3e07da) 합계에 드는 일시금이 0건이라 모두에게 '없어요'가 된다.
 */
export function oneTimeSupports(summary: CalculationSummary): OneTimeSupport[] {
  return summary.results
    .filter((r) => r.policy.benefitType === "lump_sum" && (r.status === "예상적용" || r.status === "조건충족시가능"))
    .map((r) => {
      const cap = r.policy.lumpSumCap;
      const amountText = cap == null || cap <= 0 ? null : r.policy.lumpSumBasis === "fixedGrant" ? formatKoreanMoney(cap) : `최대 ${formatKoreanMoney(cap)}`;
      return { policy: r.policy, amountText, status: r.status as OneTimeSupport["status"] };
    });
}

// ── 홈 한 줄 ──

export interface LedgerProgress {
  outDone: number;
  outTotal: number;
  inDone: number;
  inTotal: number;
  complete: boolean;
}

/** 그 달 누른 개수. 계약 기간 밖이거나 칸이 없으면 null(홈 한 줄을 숨긴다). */
export function ledgerProgress(view: LedgerMonthView): LedgerProgress | null {
  if (!view.inContract || view.lines.length === 0) return null;
  const out = view.lines.filter((l) => l.side === "out");
  const income = view.lines.filter((l) => l.side === "in");
  const outDone = out.filter((l) => l.done).length;
  const inDone = income.filter((l) => l.done).length;
  return { outDone, outTotal: out.length, inDone, inTotal: income.length, complete: outDone === out.length && inDone === income.length };
}
