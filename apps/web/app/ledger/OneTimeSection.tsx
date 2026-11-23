import { Icon3D } from "@/app/components";
import { oneTimeForMonth, receivedMonthLabel, toggleOneTime, type LedgerRecord, type MonthKey, type OneTimeSupport } from "@/lib/ledger";
import { CheckButton } from "./CheckButton";

/**
 * 한 번 받는 지원 (설계 §3.5). 결과에서 받을 수 있다고 나온 일시금 — 달마다 넣지 않고, 받으면 한 번 누른다.
 * 누르면 보고 있는 달을 받은 달로 남긴다. 실제 부담 · 누적에서는 빼지 않는다(결정 ④).
 * 받은 달 다음 달부터는 목록에서 빼고 '받은 달에서 볼 수 있어요' 한 줄만 남긴다(ggue 11/23) — 받은 달로 가면 다시 보여 풀 수 있다.
 */
export function OneTimeSection({
  supports,
  record,
  month,
  todayMonth,
  onChange,
}: {
  supports: OneTimeSupport[];
  record: LedgerRecord;
  month: MonthKey;
  todayMonth: MonthKey;
  onChange: (record: LedgerRecord) => void;
}) {
  const { shown, hiddenCount } = oneTimeForMonth(supports, record, month);
  const hiddenNote = `받은 지원 ${hiddenCount}건은 받은 달에서 볼 수 있어요.`;
  return (
    <section aria-label="한 번 받는 지원" className="mt-7 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold leading-snug text-ink-900">한 번 받는 지원</h2>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-card bg-surface px-[18px] py-4 text-sm leading-normal text-ink-600 shadow-card">
          {hiddenCount > 0 ? hiddenNote : "결과에서 받을 수 있다고 나온 한 번 받는 지원이 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map(({ policy, amountText, status }) => {
            const got = record.oneTime[policy.id];
            return (
              <li key={policy.id} className="flex items-center gap-3 rounded-card bg-surface px-[18px] py-4 shadow-card">
                <Icon3D name={policy.icon} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold leading-snug text-ink-900">{policy.name}</span>
                  {(amountText || status === "조건충족시가능") && (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {amountText && <span className="text-[13px] leading-snug text-ink-600">{amountText}</span>}
                      {status === "조건충족시가능" && (
                        <span className="inline-flex h-5 items-center rounded-full bg-ink-100 px-1.5 text-xs font-bold text-ink-600">확인 필요</span>
                      )}
                    </span>
                  )}
                </div>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <CheckButton pressed={got !== undefined} label={`${policy.name} 받았어요`} onClick={() => onChange(toggleOneTime(record, policy.id, month))}>
                    받았어요
                  </CheckButton>
                  {got !== undefined && <span className="text-xs font-semibold text-brand-800">{receivedMonthLabel(got, todayMonth)}에 받음</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 0 && hiddenCount > 0 && <p className="text-[13px] leading-normal text-ink-500">{hiddenNote}</p>}
    </section>
  );
}
