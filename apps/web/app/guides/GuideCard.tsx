import Link from "next/link";
import { Icon3D } from "@/app/components";
import type { Guide } from "@/lib/guides";

/** 가이드 카드 — 홈 가로 줄(compact)과 /guides 목록이 같이 쓴다. tag 를 주면 첫 카드 강조(얇은 파랑 테두리 + 오른쪽 위 꼬리표). */
export function GuideCard({
  guide,
  compact = false,
  tag = null,
}: {
  /** 카드에 필요한 것만 — 집 보러 갈 때 체크리스트(HOUSE_CHECKLIST_CARD, id "checklist")도 같은 카드로 /guides/checklist 에 간다 */
  guide: Pick<Guide, "id" | "title" | "summary" | "icon">;
  compact?: boolean;
  tag?: string | null;
}) {
  return (
    <Link
      href={`/guides/${guide.id}`}
      className={`focus-ring relative flex rounded-card bg-surface shadow-card ${tag ? "ring-[1.5px] ring-inset ring-brand-600/35" : ""} ${
        compact ? "w-[164px] shrink-0 flex-col gap-3 px-4 pb-4 pt-[18px]" : "items-center gap-3.5 p-4"
      }`}
    >
      <Icon3D name={guide.icon} size={compact ? 40 : 48} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-bold leading-snug text-ink-900">{guide.title}</span>
        <span className="text-[13px] leading-normal text-ink-500">{guide.summary}</span>
      </span>
      {tag && (
        <span className="absolute right-3 top-3.5 inline-flex h-[22px] items-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-800">
          {tag}
        </span>
      )}
    </Link>
  );
}
