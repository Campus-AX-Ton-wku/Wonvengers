"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ICON_SM, Pencil } from "@/app/components/icons";
import {
  addMonths,
  ledgerMonth,
  monthLabel,
  monthOnlyLabel,
  monthsBetween,
  setLineAmount,
  toggleLine,
  yearTotalLabel,
  type LedgerLine,
  type LedgerMonthView,
  type LedgerPlan,
  type LedgerRecord,
  type MonthKey,
} from "@/lib/ledger";
import { formatKoreanMoney } from "@/lib/money";
import { AmountSheet } from "./AmountSheet";
import { CheckButton } from "./CheckButton";

/**
 * 달 넘기기 + 한 달 카드 (시안 '주거비 달력 · 달력 탭', 설계 §3.2 · §3.3).
 * 넘길 수 있는 범위는 계약 시작 달 앞 12개월 ~ 마지막 달 뒤 12개월.
 */
export function MonthSection({
  plan,
  record,
  month,
  todayMonth,
  onMonth,
  onChange,
}: {
  plan: LedgerPlan;
  record: LedgerRecord;
  month: MonthKey;
  todayMonth: MonthKey;
  onMonth: (month: MonthKey) => void;
  onChange: (record: LedgerRecord) => void;
}) {
  const [editing, setEditing] = useState<LedgerLine | null>(null);
  const view = ledgerMonth(plan, record, month);
  const canPrev = monthsBetween(addMonths(plan.start, -12), month) > 0;
  const canNext = monthsBetween(month, addMonths(plan.end, 12)) > 0;
  const out = view.lines.filter((l) => l.side === "out");
  const income = view.lines.filter((l) => l.side === "in");

  return (
    <div className="mt-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <MonthArrow label="이전 달" disabled={!canPrev} onClick={() => onMonth(addMonths(month, -1))}>
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </MonthArrow>
        <p aria-live="polite" className="text-lg font-extrabold text-ink-900">
          {monthLabel(month)}
        </p>
        <MonthArrow label="다음 달" disabled={!canNext} onClick={() => onMonth(addMonths(month, 1))}>
          <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
        </MonthArrow>
      </div>

      {view.inContract ? (
        <section aria-label={`${monthOnlyLabel(month)} 주거비`} className="flex flex-col gap-3.5 rounded-card bg-surface p-[18px] shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-extrabold leading-snug text-ink-900">계약 {view.contractMonth}개월째</h2>
            <span className="text-[13px] font-semibold text-ink-500">
              {monthLabel(plan.start)} 시작 · {plan.months}개월
            </span>
          </div>
          <LineGroup title="나가는 돈" lines={out} verb="냈어요" month={month} record={record} onChange={onChange} onEdit={setEditing} />
          {income.length > 0 && (
            <>
              <span aria-hidden="true" className="h-px bg-ink-100" />
              <LineGroup title="들어오는 돈" lines={income} verb="받았어요" month={month} record={record} onChange={onChange} onEdit={setEditing} />
            </>
          )}
          <Totals view={view} yearLabel={yearTotalLabel(month, todayMonth)} />
        </section>
      ) : (
        <OutOfContract plan={plan} onStart={() => onMonth(plan.start)} />
      )}

      {editing && (
        <AmountSheet
          month={month}
          line={editing}
          onClose={() => setEditing(null)}
          onSave={(won) => {
            onChange(setLineAmount(record, month, editing, won));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MonthArrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex size-11 items-center justify-center rounded-[14px] bg-surface text-ink-700 shadow-[inset_0_0_0_1px_var(--color-ink-200)] disabled:text-ink-300"
    >
      {children}
    </button>
  );
}

function LineGroup({
  title,
  lines,
  verb,
  month,
  record,
  onChange,
  onEdit,
}: {
  title: string;
  lines: LedgerLine[];
  verb: "냈어요" | "받았어요";
  month: MonthKey;
  record: LedgerRecord;
  onChange: (record: LedgerRecord) => void;
  onEdit: (line: LedgerLine) => void;
}) {
  return (
    <div className="flex flex-col">
      <p className="mb-0.5 text-[13px] font-bold text-ink-500">{title}</p>
      {lines.map((line) => (
        <div key={line.key} className="flex min-h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-sm leading-snug text-ink-600">{line.label}</span>
            <button
              type="button"
              onClick={() => onEdit(line)}
              aria-label={`${line.label} 금액 ${formatKoreanMoney(line.amount)}${line.edited ? " (고침)" : ""}, 고치기`}
              className="focus-ring -mx-1 -my-0.5 inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg px-1"
            >
              <span className="text-[17px] font-bold leading-tight text-brand-900 underline decoration-ink-300 decoration-dotted underline-offset-4">
                {formatKoreanMoney(line.amount)}
              </span>
              <Pencil size={14} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-500" />
              {line.edited && (
                <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-warn-50 px-1.5 text-xs font-bold text-warn-800">고침</span>
              )}
            </button>
            {line.edited && <span className="text-xs leading-snug text-ink-500">계산할 때 {formatKoreanMoney(line.planned)}</span>}
            {line.note && <span className="text-xs leading-snug text-ink-500">{line.note}</span>}
          </div>
          <CheckButton pressed={line.done} label={`${line.label} ${verb}`} onClick={() => onChange(toggleLine(record, month, line.key, line.amount))}>
            {verb}
          </CheckButton>
        </div>
      ))}
    </div>
  );
}

/** 이번 달 실제 부담 · 예상 · 누적 (설계 §4.4). 음수면 0원 + "지원이 N원 더 많아요". */
function Totals({ view, yearLabel }: { view: LedgerMonthView; yearLabel: string }) {
  const more = view.actual < 0 ? -view.actual : 0;
  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink-900 pt-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-ink-900">이번 달 실제 부담</span>
        <span data-testid="ledger-actual" className="whitespace-nowrap text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-brand-900">
          {formatKoreanMoney(view.actual)}
        </span>
        {more > 0 && <span className="text-[13px] font-semibold text-ok-700">지원이 {formatKoreanMoney(more)} 더 많아요</span>}
        <span className="text-[13px] leading-normal text-ink-600">
          예상 {formatKoreanMoney(view.expected)}
          {view.pending && " · 아직 안 누른 칸은 빼고 셈해요"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 rounded-[14px] bg-ink-50 px-3.5 py-3">
        <span className="text-sm font-semibold text-ink-700">{yearLabel}</span>
        <span data-testid="ledger-year" className="whitespace-nowrap text-[17px] font-extrabold text-brand-900">
          {formatKoreanMoney(view.yearTotal)}
        </span>
      </div>
    </div>
  );
}

function OutOfContract({ plan, onStart }: { plan: LedgerPlan; onStart: () => void }) {
  return (
    <section aria-label="계약 기간 밖" className="flex flex-col items-center gap-2.5 rounded-card bg-surface px-[22px] pb-[22px] pt-7 text-center shadow-card">
      <span aria-hidden="true" className="flex size-13 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <CalendarDays size={26} strokeWidth={2} />
      </span>
      <h2 className="text-[19px] font-extrabold leading-snug text-ink-900">계약 기간 밖이에요</h2>
      <p className="text-sm leading-normal text-ink-600">
        계약 기간은{" "}
        <b className="font-bold text-ink-900">
          {monthLabel(plan.start)} ~ {monthLabel(plan.end)}
        </b>
        ({plan.months}개월)이에요.
        <br />이 달엔 적을 칸이 없어요.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="focus-ring mt-1 inline-flex min-h-11 items-center gap-0.5 rounded-[14px] bg-brand-50 px-3.5 text-sm font-bold text-brand-700"
      >
        계약 시작 달({monthOnlyLabel(plan.start)})로 가기
        <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" />
      </button>
    </section>
  );
}
