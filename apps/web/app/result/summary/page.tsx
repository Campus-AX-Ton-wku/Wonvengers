"use client";

import Link from "next/link";
import exampleListingsData from "@/data/example-listings.json";
import type { ExampleListing } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { exampleBadge, isVerifiedExample } from "@/lib/examples";
import { AlertIcon, CheckIcon } from "@/app/icons";
import { useResultData } from "../useResultData";

/**
 * F4-11. 캡처해서 공유하기 좋은 한 화면 요약.
 *
 * 결과 화면(/result)은 정책 카드·대출 상품·고지까지 길어서 스크린샷 한 장에 담기지
 * 않는다. 여기는 스크롤 없이 한 화면에 들어가는 것이 유일한 목표이므로, 담는 값을
 * 의도적으로 줄였다 — 두 금액(F4-4), 조합, 미확인 조건 유무, 기준일(F4-10).
 *
 * 숫자는 /result 와 같은 함수(useResultData + summaryHighlights)에서 나온다.
 * 각자 계산하면 캡처한 요약과 상세 화면의 금액이 어긋난다.
 */

const exampleListings = exampleListingsData as ExampleListing[];

export default function ResultSummaryPage() {
  const { listing, summary, asOf } = useResultData();

  if (!listing || !summary) {
    return <main className="p-10 text-center text-ink-500">불러오는 중...</main>;
  }

  const { included, unknownConditions } = summaryHighlights(summary);
  const activeExample = exampleListings.find((e) => e.id === listing.exampleId) ?? null;
  const exampleUnverified = activeExample !== null && !isVerifiedExample(activeExample);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-5 py-6">
      {/* 캡처 대상. 화면 밖으로 넘치지 않게 담는 항목을 제한한다. */}
      <section className="amount-in rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-base font-extrabold tracking-tight text-ink-900">Perky</p>
          <p className="text-[11px] font-semibold text-ink-500">{asOf} 기준</p>
        </div>

        {/* 결과 화면의 금액 상자와 같은 표현 — 받는 돈만 accent, 내는 돈은 중립색. */}
        <div className="mt-4 rounded-xl bg-brand-50 p-4">
          <p className="text-xs font-semibold text-accent-700">최대 지원 가능액</p>
          <p className="text-3xl font-extrabold leading-tight text-accent-600 tabular-nums">
            {summary.maxSupportAmount.toLocaleString()}원
          </p>

          <div className="my-3 h-px bg-brand-200" />

          <p className="text-xs font-semibold text-ink-500">최종 예상 주거비</p>
          <p className="text-3xl font-extrabold leading-tight text-ink-900 tabular-nums">
            {summary.finalEstimatedHousingCost.toLocaleString()}원
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            명목 총 지출 {summary.nominalTotalCost.toLocaleString()}원 기준
          </p>
        </div>

        {included.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {included.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-1.5 text-xs leading-snug text-ink-600">
                  <CheckIcon size={14} className="mt-px shrink-0 text-ok-700" />
                  {item.name}
                </span>
                <span className="shrink-0 text-xs font-bold text-ink-900 tabular-nums">
                  {item.amount.toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-ink-600">
            지금 조건으로 합산할 수 있는 지원금이 없습니다.
          </p>
        )}

        {(unknownConditions.length > 0 || activeExample) && (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-ink-100 pt-3">
            {unknownConditions.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] font-bold leading-relaxed text-warn-800">
                <AlertIcon size={14} className="mt-px shrink-0" />
                아직 확인되지 않은 조건 {unknownConditions.length}건이 이 금액에 포함되어 있습니다
              </p>
            )}
            {activeExample && (
              <p
                className={`flex items-start gap-1.5 text-[11px] font-bold leading-relaxed ${
                  exampleUnverified ? "text-warn-800" : "text-ok-700"
                }`}
              >
                <AlertIcon size={14} className="mt-px shrink-0" />
                예시 매물({activeExample.label}) 조건으로 계산 — {exampleBadge(activeExample)}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
          조건 충족 시 받을 수 있는 상한입니다. 신청 자격을 확정하는 것이 아니며 최종 지원액은
          각 기관이 심사해 결정합니다.
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <p className="text-center text-xs text-ink-500">이 화면을 그대로 캡처해서 공유하세요.</p>
        <Link
          href="/result"
          className="rounded-xl border border-ink-200 py-3 text-center text-sm font-bold text-ink-600 transition-colors hover:border-ink-500 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          결과 상세로 돌아가기
        </Link>
      </div>
    </main>
  );
}
