import Link from "next/link";
import noticesData from "@/data/notices.json";
import { ChevronRight, ICON_SM } from "@/app/components/icons";
import { NoticeCard } from "@/app/housing/NoticeCard";
import { homeNotices, type NoticeSnapshot } from "@/lib/notices";

const snapshot = noticesData as NoticeSnapshot;

/**
 * 익산 청약 공고 (11/22) — 다가오는 일정 아래, 주거 가이드 위(마감이 있는 정보라 가이드보다 위).
 * 접수 중 → 예정 순 3장. 남은 공고가 없으면 줄째 숨긴다.
 */
export function NoticeRow({ today }: { today: string }) {
  const notices = today ? homeNotices(snapshot.notices, today) : [];
  if (notices.length === 0) return null;
  return (
    <section aria-labelledby="notices-heading" className="mt-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="notices-heading" className="text-lg font-extrabold leading-snug text-ink-900">
          익산 청약 공고
        </h2>
        <Link href="/housing" className="focus-ring -mr-1.5 inline-flex min-h-11 items-center gap-0.5 px-1.5 text-sm font-semibold text-ink-600">
          전체 보기
          <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-0.5 [scrollbar-width:none] min-[390px]:-mx-5 min-[390px]:px-5">
        {notices.map((notice) => (
          <li key={notice.id} className="flex">
            <NoticeCard notice={notice} today={today} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
