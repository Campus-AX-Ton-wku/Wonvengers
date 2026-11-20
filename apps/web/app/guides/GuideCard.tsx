import Link from "next/link";
import { Icon3D } from "@/app/components";
import type { Guide } from "@/lib/guides";

/** 가이드 카드 — 홈 가로 줄(compact)과 /guides 목록이 같이 쓴다. */
export function GuideCard({ guide, compact = false }: { guide: Guide; compact?: boolean }) {
  return (
    <Link
      href={`/guides/${guide.id}`}
      className={`focus-ring flex rounded-card bg-surface shadow-card ${
        compact ? "w-[164px] shrink-0 flex-col gap-3 px-4 pb-4 pt-[18px]" : "items-center gap-3.5 p-4"
      }`}
    >
      <Icon3D name={guide.icon} size={compact ? 40 : 48} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-bold leading-snug text-ink-900">{guide.title}</span>
        <span className="text-[13px] leading-normal text-ink-500">{guide.summary}</span>
      </span>
    </Link>
  );
}
