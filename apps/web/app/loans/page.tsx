"use client";

import { useEffect, useState } from "react";
import loanProductsData from "@/data/loan-products.json";
import { AppShell, TopBar } from "@/app/components";
import { orderedLoans } from "@/lib/loans";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, LoanProductMeta } from "@/lib/types";
import { LoanCard } from "./LoanCard";

const products = loanProductsData as LoanProductMeta[];

/**
 * 대출 · 보증 전체 (홈 '대출 · 보증 › 전체 보기' · 결과 화면 한 줄). 로그인 없이 열린다.
 * 순서 · 거르기는 홈과 같다(lib/loans.ts orderedLoans) — 이 기기의 1층 답(지역 · 집 형태)으로. 답이 없으면 전부 데이터 순서.
 */
export default function LoansPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setAnswers(loadAnswers());
    setReady(true);
  }, []);
  const { loans, tag } = orderedLoans(products, { region: answers.region, housingType: answers.housingType });
  return (
    <AppShell>
      <TopBar backHref="/home" />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">대출 · 보증</h1>
        <p className="text-[15px] leading-relaxed text-ink-600">현금 지원이 아니라서 지원금 합계에는 넣지 않아요. 이자 절감액은 계산하지 않아요.</p>
        {ready ? (
          <ul className="flex flex-col gap-3">
            {loans.map((product, i) => (
              <li key={product.id}>
                <LoanCard product={product} tag={i === 0 ? tag : null} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-center text-sm text-ink-500">불러오는 중…</p>
        )}
      </main>
    </AppShell>
  );
}
