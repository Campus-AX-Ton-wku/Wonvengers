import Link from "next/link";
import { CalendarDays, ChevronRight, ICON_MD } from "@/app/components/icons";
import type { LedgerProgress } from "@/lib/ledger";

/**
 * 홈 → 주거비 달력 입구 한 줄 (시안 '홈 · 주거비 달력 입구 한 줄', 설계 §6). 주거비 상자 바로 아래.
 * 이번 달 누른 개수, 다 누르면 초록 "이번 달 다 적었어요".
 */
export function LedgerRow({ progress }: { progress: LedgerProgress }) {
  const { outDone, outTotal, inDone, inTotal, complete } = progress;
  const text = complete ? "이번 달 다 적었어요" : [`낸 돈 ${outDone}/${outTotal}`, inTotal > 0 ? `받은 지원 ${inDone}/${inTotal}` : null].filter(Boolean).join(" · ");
  const spoken = complete
    ? "이번 달 다 적었어요"
    : `낸 돈 ${outTotal}개 중 ${outDone}개${inTotal > 0 ? `, 받은 지원 ${inTotal}개 중 ${inDone}개` : ""} 기록`;
  return (
    <Link
      href="/ledger"
      aria-label={`이번 달 주거비, ${spoken}. 주거비 달력 열기`}
      className="focus-ring flex min-h-[60px] items-center gap-3 rounded-control bg-surface py-2.5 pl-3.5 pr-3 shadow-[inset_0_0_0_1px_var(--color-ink-200)] transition-colors hover:bg-ink-50"
    >
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <CalendarDays size={ICON_MD} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-sm font-bold leading-snug text-ink-900">이번 달 주거비</span>
        <span className={`text-[13px] font-semibold leading-snug ${complete ? "text-ok-700" : "text-ink-600"}`}>{text}</span>
      </span>
      <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-ink-500" />
    </Link>
  );
}
