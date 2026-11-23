import Link from "next/link";
import { ChevronRight, ICON_MD } from "@/app/components/icons";
import { SAVED_PREPARING_HREF } from "@/lib/home";

/**
 * 내 기록 (내 프로필 설계 §3) — 앱에서 쌓은 것의 개수만. 금액은 안 보인다.
 * 관심 지원금 n개 → 관심 탭 · 신청 준비 중 n개 → 관심 탭의 '신청 준비 중' 보기(체크한 것만, 11/23) · 달력 기록 n달 → 달력 탭.
 */
export function MyRecords({ saved, preparing, ledgerMonths }: { saved: number; preparing: number; ledgerMonths: number }) {
  const rows = [
    { label: "관심 지원금", value: `${saved}개`, href: "/saved" },
    { label: "신청 준비 중", value: `${preparing}개`, href: SAVED_PREPARING_HREF },
    { label: "달력 기록", value: `${ledgerMonths}달`, href: "/ledger" },
  ];
  return (
    <section aria-labelledby="my-records" className="flex flex-col gap-2.5">
      <h2 id="my-records" className="text-base font-bold text-ink-900">
        내 기록
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              href={row.href}
              className="press focus-ring flex min-h-[76px] flex-col justify-between gap-1 rounded-control bg-surface px-3 py-3 shadow-card"
            >
              <span className="text-xs font-semibold text-ink-600">{row.label}</span>
              <span className="flex items-center justify-between gap-1">
                <span className="text-lg font-extrabold text-ink-900">{row.value}</span>
                <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
