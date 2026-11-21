"use client";

import { useState } from "react";
import { Button, MoneyInput, Sheet } from "@/app/components";
import { monthOnlyLabel, type LedgerLine, type MonthKey } from "@/lib/ledger";
import { formatKoreanMoney } from "@/lib/money";

/**
 * 금액 고치기 (시안 '금액 고치기' 시트). 만원 단위로 넣고(4.2 → 42,000원) 이 달 이 칸에만 적용한다.
 * [계산값으로]는 고친 적 있을 때만. 계산값과 같은 금액을 저장하면 고친 것으로 치지 않는다(setLineAmount).
 */
export function AmountSheet({
  month,
  line,
  onSave,
  onClose,
}: {
  month: MonthKey;
  line: LedgerLine;
  /** null = 계산값으로 */
  onSave: (won: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<number | null>(line.amount);
  const verb = line.side === "out" ? "낸" : "받은";
  return (
    <Sheet
      title={`${monthOnlyLabel(month)} ${line.label}`}
      description={`실제로 ${verb} 금액이 다르면 고쳐 주세요. 이 달에만 바뀌어요.`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ledger-amount" className="text-[13px] font-bold text-ink-700">
          실제 금액 (만원)
        </label>
        <MoneyInput id="ledger-amount" value={value} onChange={setValue} />
        <p className="text-[13px] text-ink-500">계산할 때 넣은 값은 {formatKoreanMoney(line.planned)}</p>
      </div>
      <div className="mt-4 flex gap-2.5">
        {line.edited && (
          <Button variant="quiet" full={false} onClick={() => onSave(null)}>
            계산값으로
          </Button>
        )}
        <Button variant="primary" disabled={value === null || value <= 0} onClick={() => onSave(value)}>
          저장
        </Button>
      </div>
    </Sheet>
  );
}
