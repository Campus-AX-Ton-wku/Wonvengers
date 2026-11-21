import Link from "next/link";
import { Icon3D } from "@/app/components";
import { loanMetaLine } from "@/lib/loans";
import type { LoanProductMeta } from "@/lib/types";

/** 대출 · 보증 카드 — 홈 가로 줄(compact)과 /loans 목록이 같이 쓴다. GuideCard 와 같은 모양. tag 를 주면 첫 카드 강조. */
export function LoanCard({ product, compact = false, tag = null }: { product: LoanProductMeta; compact?: boolean; tag?: string | null }) {
  return (
    <Link
      href={`/loans/${product.id}`}
      className={`focus-ring relative flex rounded-card bg-surface shadow-card ${tag ? "ring-[1.5px] ring-inset ring-brand-600/35" : ""} ${
        compact ? "w-[164px] shrink-0 flex-col gap-3 px-4 pb-4 pt-[18px]" : "items-center gap-3.5 p-4"
      }`}
    >
      <Icon3D name={product.icon} size={compact ? 40 : 48} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-bold leading-snug text-ink-900">{product.name}</span>
        <span className="text-[13px] leading-normal text-ink-500">{loanMetaLine(product)}</span>
      </span>
      {tag && (
        <span className="absolute right-3 top-3.5 inline-flex h-[22px] items-center rounded-full bg-brand-50 px-2 text-xs font-bold text-brand-800">
          {tag}
        </span>
      )}
    </Link>
  );
}
