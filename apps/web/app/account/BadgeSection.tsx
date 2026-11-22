import { BadgeMedal } from "@/app/components";
import { badgeOf, type BadgeStatus } from "@/lib/badges";
import type { BadgeId } from "@/lib/user-data";

/** "2026-11-18" → "11.18" */
function shortDate(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

/**
 * 내 정보 배지 칸 (내 프로필 설계 §7) — "배지 n/8 · 앱을 쓰다 보면 모여요", 4칸 × 2줄.
 * 받은 칸은 색 그림 + 받은 날, 아직인 칸은 회색 그림 + 진행(3/5) 또는 '아직'. 친구 · 순위 비교 없음 — 나만 본다.
 */
export function BadgeSection({
  statuses,
  earned,
}: {
  statuses: readonly BadgeStatus[];
  earned: Partial<Record<BadgeId, string>>;
}) {
  const count = statuses.filter((s) => earned[s.id]).length;
  return (
    <section aria-labelledby="badges-heading" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="badges-heading" className="text-base font-bold text-ink-900">
          배지 <span className="text-brand-700">{count}</span>/{statuses.length}
        </h2>
        <p className="text-xs text-ink-500">앱을 쓰다 보면 모여요</p>
      </div>
      <ul className="grid grid-cols-4 gap-2 rounded-card bg-surface p-3 shadow-card">
        {statuses.map((s) => {
          const day = earned[s.id];
          const sub = day ? shortDate(day) : s.progress ? `${s.progress.done}/${s.progress.total}` : "아직";
          return (
            <li key={s.id} className="flex flex-col items-center gap-1 py-1 text-center">
              <BadgeMedal id={s.id} size="md" earned={Boolean(day)} />
              <span className={`text-xs font-bold leading-tight ${day ? "text-ink-900" : "text-ink-500"}`}>{badgeOf(s.id).label}</span>
              <span className="text-[11px] leading-none text-ink-500">{sub}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
