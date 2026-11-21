import Link from "next/link";
import loanProductsData from "@/data/loan-products.json";
import { ChevronRight, ICON_SM } from "@/app/components/icons";
import { LoanCard } from "@/app/loans/LoanCard";
import { orderedLoans } from "@/lib/loans";
import type { HousingType, LoanProductMeta } from "@/lib/types";

const products = loanProductsData as LoanProductMeta[];

/**
 * 대출 · 보증 (11/22 ggue) — 주거 가이드 위, 같은 모양의 가로 카드 3장. 현금 지원이 아니라 결과 합계에는 넣지 않는다.
 * 고르기 · 순서는 /loans 와 같다(lib/loans.ts orderedLoans). 고른 게 없으면 줄째 숨긴다.
 */
export function LoanRow({ region, housingType }: { region: string | null; housingType: HousingType | null }) {
  const { loans, tag } = orderedLoans(products, { region, housingType });
  if (loans.length === 0) return null;
  return (
    <section aria-labelledby="loans-heading" className="mt-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="loans-heading" className="text-lg font-extrabold leading-snug text-ink-900">
          대출 · 보증
        </h2>
        <Link href="/loans" className="focus-ring -mr-1.5 inline-flex min-h-11 items-center gap-0.5 px-1.5 text-sm font-semibold text-ink-600">
          전체 보기
          <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-0.5 [scrollbar-width:none] min-[390px]:-mx-5 min-[390px]:px-5">
        {loans.slice(0, 3).map((product, i) => (
          <li key={product.id} className="flex">
            <LoanCard product={product} compact tag={i === 0 ? tag : null} />
          </li>
        ))}
      </ul>
    </section>
  );
}
