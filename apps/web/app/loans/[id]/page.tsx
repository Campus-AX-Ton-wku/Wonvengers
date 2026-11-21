import { notFound } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import { AppShell, ContactInfo, Icon3D, TopBar, buttonClass } from "@/app/components";
import { ExternalLink, ICON_SM, Info } from "@/app/components/icons";
import { formatDotDate } from "@/lib/date";
import { findLoan, loanMetaLine } from "@/lib/loans";
import type { LoanProductMeta } from "@/lib/types";

const products = loanProductsData as LoanProductMeta[];

/** 정적 export — 상품 수만큼 미리 만든다. */
export function generateStaticParams() {
  return products.map((p) => ({ id: p.id }));
}

/**
 * 대출 · 보증 한 장 (docs/기획/2026-11-22-대출보증-모아보기-설계.md §5).
 * 조건은 DB 의 요약 문단을 그대로 보여 준다 — 대상 · 금리 · 한도로 나누려면 원문 대조가 필요해서 이번엔 쪼개지 않는다(F0-5).
 */
export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = findLoan(products, id);
  if (!product) notFound();
  const checked = product.verifiedAt ? `${formatDotDate(product.verifiedAt)} 확인` : "원문 확인 필요";
  // 문의 주소가 신청 주소와 같으면 파란 버튼과 겹치므로 표시만 뺀다(데이터는 그대로).
  const contact = product.contact && product.contact.url === product.applyUrl ? { ...product.contact, url: null } : product.contact;
  return (
    <AppShell>
      <TopBar backHref="/loans" />
      <main className="flex flex-col gap-5 pb-10 pt-2.5">
        <header className="flex items-start gap-3.5">
          <Icon3D name={product.icon} size={64} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-extrabold leading-snug text-ink-900">{product.name}</h1>
            <p className="text-sm text-ink-600">{product.agency}</p>
          </div>
        </header>
        <p className="-mt-1 text-[13px] text-ink-500">
          {loanMetaLine(product)} · {checked}
        </p>

        <section aria-labelledby="loan-terms" className="rounded-card bg-surface p-4 shadow-card">
          <h2 id="loan-terms" className="text-sm font-bold text-ink-900">
            조건
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{product.summary}</p>
        </section>

        <p className="flex gap-2.5 rounded-card bg-ink-100 p-4 text-xs leading-relaxed text-ink-600">
          <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <span>현금 지원이 아니라서 지원금 합계에는 넣지 않아요. 이자 절감액은 계산하지 않아요.</span>
        </p>

        <div className="flex flex-col items-start gap-1">
          <a href={product.applyUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "primary", size: "screen" })}>
            신청 페이지로 이동
            <ExternalLink size={ICON_SM} aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
          {product.sourceUrl !== product.applyUrl && (
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-bold text-ink-600 underline hover:text-ink-900"
            >
              공식 출처
              <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
              <span className="sr-only">(새 창)</span>
            </a>
          )}
        </div>

        <ContactInfo contact={contact} variant="block" />
      </main>
    </AppShell>
  );
}
