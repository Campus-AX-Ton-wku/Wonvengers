import Link from "next/link";
import { DeadlineBadge } from "@/app/components";
import { formatDotDate } from "@/lib/date";
import { noticeHref } from "@/lib/notice-detail";
import { noticeDeadlineLabel, type HousingNotice } from "@/lib/notices";

/** 청약 공고 카드 — /housing 목록과 홈 가로 줄(compact)이 같이 쓴다. 카드 → 공고 상세(원문은 상세 아래 버튼). 자격 판정 표시는 두지 않는다(F0-5). */
export function NoticeCard({ notice, today, compact = false }: { notice: HousingNotice; today: string; compact?: boolean }) {
  const period = [notice.applyStart, notice.applyEnd].map((d) => (d ? formatDotDate(d) : "")).join(" ~ ");
  return (
    <Link
      href={noticeHref(notice.id)}
      className={`focus-ring flex flex-col gap-2 rounded-card bg-surface shadow-card ${compact ? "w-[220px] shrink-0 px-4 pb-4 pt-[18px]" : "p-4"}`}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-[22px] items-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-800">{notice.typeLabel}</span>
        <DeadlineBadge label={noticeDeadlineLabel(notice, today)} />
      </span>
      <span className="text-base font-bold leading-snug text-ink-900">{notice.title}</span>
      <span className="text-[13px] leading-normal text-ink-500">
        {[notice.supplier, period].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}
