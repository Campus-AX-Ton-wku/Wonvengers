import Link from "next/link";
import { Icon3D, LinkButton, StatusBadge, type BadgeTone } from "@/app/components";
import { CalendarDays, ChevronRight, Clock, ICON_MD, ICON_SM, Info, ListChecks } from "@/app/components/icons";
import type { TodoItem } from "@/lib/home-today";
import type { Icon3DName } from "@/lib/icons3d";

type Progress = { done: number; total: number; label: string };

interface TodoContent {
  icon: Icon3DName;
  badge: { label: string; tone: BadgeTone; icon: typeof Clock };
  title: string;
  sub: string;
  progress: Progress | null;
  cta: { label: string; href: string };
}

const monthDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
};

/** 한 만큼만 말한다 — "서류만 확인하면 돼요"처럼 자격을 확정하는 말은 쓰지 않는다 (설계 3절) */
function progressSentence(p: Progress): string {
  if (p.done === 0) return "아직 준비를 시작하지 않았어요.";
  if (p.done >= p.total) return "준비를 마쳤어요. 이제 신청만 남았어요.";
  return `${p.label}까지 했어요.`;
}

export function todoContent(item: TodoItem): TodoContent {
  switch (item.kind) {
    case "deadline":
      return {
        icon: item.policy.icon,
        badge: { label: item.days === 0 ? "오늘 마감" : `D-${item.days}`, tone: "danger", icon: Clock },
        title: item.policy.name,
        sub: `${item.days === 0 ? "오늘 마감이에요." : `마감까지 ${item.days}일 남았어요.`} ${progressSentence(item.progress)}`,
        progress: item.progress,
        cta: { label: "이어서 준비하기", href: `/find/policies/${item.policy.id}/prepare` },
      };
    case "starts-today":
      return {
        icon: item.policy.icon,
        badge: { label: "오늘 신청 시작", tone: "info", icon: CalendarDays },
        title: item.policy.name,
        sub: "관심에 담아 둔 지원금이에요. 오늘부터 신청할 수 있어요.",
        progress: null,
        cta: { label: "공고 보러 가기", href: `/find/policies/${item.policy.id}` },
      };
    case "new":
      return {
        icon: item.policy.icon,
        badge: { label: "새 지원금", tone: "info", icon: Info },
        title: item.policy.name,
        sub: item.tag === "가능성 있음" ? "내 조건에 맞는 새 지원금이 올라왔어요." : "받을 수도 있는 새 지원금이 올라왔어요.",
        progress: null,
        cta: { label: "보러 가기", href: `/find/policies/${item.policy.id}` },
      };
    case "opened":
      return {
        icon: item.policy.icon,
        badge: { label: "새로 열림", tone: "info", icon: CalendarDays },
        title: item.policy.name,
        sub: `내 조건에 맞는 지원금이 ${monthDay(item.policy.applicationStart)}부터 신청을 받고 있어요.`,
        progress: null,
        cta: { label: "보러 가기", href: `/find/policies/${item.policy.id}` },
      };
    case "calc":
      return {
        icon: "calculator",
        badge: { label: "1분이면 돼요", tone: "muted", icon: Clock },
        title: "실제로 내는 돈, 계산해 볼까요?",
        sub: "보증금·월세만 넣으면 지원 받은 뒤 부담을 알려 드려요.",
        progress: null,
        cta: { label: "계산하기", href: "/calculate" },
      };
    case "stalled":
      return {
        icon: item.policy.icon,
        badge: { label: "준비 중", tone: "info", icon: ListChecks },
        title: item.policy.name,
        sub: `${item.progress.label}까지 했어요. 이어서 챙겨요.`,
        progress: item.progress,
        cta: { label: "이어서 준비하기", href: `/find/policies/${item.policy.id}/prepare` },
      };
  }
}

/**
 * 오늘 할 일 (시안 '홈 보강', 11/20) — 딱 하나. 이 화면의 파랑 버튼은 이것 하나다.
 * 진행 막대는 그림이라 읽지 않는다 — 설명 문장이 진행을 이미 말한다.
 */
export function TodayCard({ item, more }: { item: TodoItem; more: number }) {
  const c = todoContent(item);
  return (
    <section
      aria-labelledby="today-heading"
      className="mt-5 flex flex-col gap-3.5 rounded-card px-[18px] pb-[18px] pt-3.5 shadow-card ring-1 ring-inset ring-brand-600/10"
      style={{ background: "linear-gradient(165deg, var(--color-brand-50) 0%, var(--color-surface) 60%)" }}
    >
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id="today-heading" className="flex items-center gap-1.5 text-sm font-extrabold text-brand-700">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
          오늘 할 일
        </h2>
        {more > 0 && (
          <Link
            href="/notifications"
            aria-label={`다른 할 일 ${more}개, 알림함에서 보기`}
            className="focus-ring -my-1.5 -mr-2 flex min-h-11 items-center gap-0.5 rounded-control px-2 text-[13px] font-semibold text-ink-600"
          >
            {more}개 더
            <ChevronRight size={ICON_SM} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="flex items-start gap-3.5">
        <Icon3D name={c.icon} size={48} />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusBadge tone={c.badge.tone} icon={c.badge.icon}>
            {c.badge.label}
          </StatusBadge>
          <p className="text-[17px] font-extrabold leading-snug text-ink-900">{c.title}</p>
          <p className="text-sm leading-normal text-ink-600">{c.sub}</p>
        </div>
      </div>
      {c.progress && (
        <div aria-hidden="true" className="flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
            <span
              className="block h-full rounded-full bg-brand-600"
              style={{ width: `${Math.round((c.progress.done / c.progress.total) * 100)}%` }}
            />
          </span>
          <span className="text-[13px] font-bold text-brand-800">
            {c.progress.done}/{c.progress.total}
          </span>
        </div>
      )}
      <LinkButton href={c.cta.href} size="screen" full>
        {c.cta.label}
        <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="-ml-1" />
      </LinkButton>
    </section>
  );
}
