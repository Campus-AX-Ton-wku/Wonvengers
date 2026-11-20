import Link from "next/link";
import { ChevronRight, ICON_MD, ICON_SM } from "@/app/components/icons";
import type { ScheduleEvent } from "@/lib/home-today";
import { UPCOMING_DAYS } from "@/lib/inbox";

const DAY = 86_400_000;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/** 목록에 보이는 줄 수 — 나머지는 머리글 '알림함 ›'에서 */
const LIST_MAX = 3;

const shiftISO = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY).toISOString().slice(0, 10);
const weekday = (iso: string) => WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const dotDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
};

export function eventLabel(e: ScheduleEvent): string {
  if (e.kind === "start") return e.days === 0 ? "오늘 신청 시작" : "신청 시작";
  return e.days === 0 ? "마감 · 오늘" : `마감 · D-${e.days}`;
}

/**
 * 다가오는 일정 (시안 '홈 보강', 11/20) — 관심 지원금의 신청 시작 · 마감, 오늘부터 14일.
 * 일정이 없으면 이 블록을 그리지 않는다(부르는 쪽, 11/20 ggue 결정). 날짜 줄은 보기용 그림이라 읽지 않고 목록만 읽는다.
 */
export function ScheduleCard({ events, today }: { events: ScheduleEvent[]; today: string }) {
  const days = Array.from({ length: UPCOMING_DAYS + 1 }, (_, i) => shiftISO(today, i));
  return (
    <section aria-labelledby="schedule-heading" className="mt-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="schedule-heading" className="text-lg font-extrabold leading-snug text-ink-900">
          다가오는 일정
        </h2>
        <Link
          href="/notifications"
          className="focus-ring -mr-1.5 inline-flex min-h-11 items-center gap-0.5 px-1.5 text-sm font-semibold text-ink-600"
        >
          알림함
          <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-surface px-4 pb-2.5 pt-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-600">관심 지원금 · 2주</span>
          <span aria-hidden="true" className="flex items-center gap-2.5 text-xs font-semibold text-ink-500">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-danger-600" />
              마감
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-brand-600" />
              신청 시작
            </span>
          </span>
        </div>
        <div aria-hidden="true" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 pt-1 [scrollbar-width:none]">
          {days.map((iso, i) => {
            const marks = events.filter((e) => e.date === iso);
            const isToday = i === 0;
            return (
              <span
                key={iso}
                className={`flex h-[66px] w-11 shrink-0 flex-col items-center gap-[3px] rounded-[14px] pt-[9px] ${isToday ? "bg-ink-900" : ""}`}
              >
                <span className={`text-xs font-semibold ${isToday ? "text-surface/70" : "text-ink-500"}`}>{isToday ? "오늘" : weekday(iso)}</span>
                <span className={`text-[17px] font-bold leading-tight ${isToday ? "text-surface" : "text-ink-900"}`}>{Number(iso.slice(8))}</span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {marks.some((e) => e.kind === "end") && <span className="size-1.5 rounded-full bg-danger-600" />}
                  {marks.some((e) => e.kind === "start") && <span className="size-1.5 rounded-full bg-brand-600" />}
                </span>
              </span>
            );
          })}
        </div>
        <ul className="flex flex-col border-t border-ink-100 pt-1">
          {events.slice(0, LIST_MAX).map((e) => (
            <li key={`${e.kind}:${e.policy.id}`}>
              <Link href={`/find/policies/${e.policy.id}`} className="focus-ring flex min-h-14 items-center gap-3 rounded-control py-1.5">
                <span className="flex w-11 shrink-0 flex-col items-center">
                  <span className="text-[15px] font-bold leading-snug text-ink-900">{dotDate(e.date)}</span>
                  <span className="text-xs text-ink-500">{weekday(e.date)}요일</span>
                </span>
                <span aria-hidden="true" className={`my-1 w-[3px] self-stretch rounded-full ${e.kind === "end" ? "bg-danger-600" : "bg-brand-600"}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-ink-900">{e.policy.name}</span>
                  <span className={`text-[13px] font-semibold ${e.kind === "end" && e.days <= 7 ? "text-danger-700" : "text-ink-600"}`}>
                    {eventLabel(e)}
                  </span>
                </span>
                <ChevronRight size={ICON_MD} strokeWidth={2} aria-hidden="true" className="shrink-0 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
