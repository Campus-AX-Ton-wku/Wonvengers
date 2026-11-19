"use client";

import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import type { LoanProductMeta } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { excludedByOverlap } from "@/lib/combinations";
import { loanProductsForRegion } from "@/lib/region";
import { formatDotDate } from "@/lib/date";
import {
  AppShell,
  Button,
  ContactInfo,
  Disclosure,
  Icon3D,
  TopBar,
} from "@/app/components";
import {
  ChevronDown,
  ExternalLink,
  ICON_SM,
  Info,
} from "@/app/components/icons";
import { useResultData } from "./useResultData";
import MissingInput from "./MissingInput";
import BenefitResultCard from "./BenefitResultCard";
import { ResultReceipt } from "./ResultReceipt";
import { ResultLoading, ResultState } from "./ResultState";
import { benefitResultCards } from "@/lib/benefit-result";

const allLoanProducts = loanProductsData as LoanProductMeta[];

/** 대출·보증 상품을 접은 목록에서 한 줄로 구분하는 이름 */
const PRODUCT_TYPE_LABEL: Record<LoanProductMeta["productType"], string> = {
  loan_interest_subsidy: "대출 · 이자 지원",
  guarantee_fee_subsidy: "보증료 지원",
  savings_account: "청약 · 저축",
};

export default function ResultPage() {
  const router = useRouter();
  const { listing, summary, asOf, status, expiredAt, retry } = useResultData();

  if (status === "loading") return <ResultLoading />;
  if (status === "missing") return <MissingInput />;
  if (status === "error") return <ResultState kind="error" onRetry={retry} />;
  if (status === "empty") return <ResultState kind="empty" />;
  if (status === "expired") return <ResultState kind="expired" endDate={expiredAt} />;
  if (!listing || !summary) {
    return <ResultState kind="error" onRetry={retry} />;
  }

  const { included, unknownConditions } = summaryHighlights(summary);
  // 카드 금액이 맨 위 합계에 들어갔는지(금색 여부)는 최선 조합으로 정한다 — 중복 수급으로 빠진 정책도 있다.
  const cards = benefitResultCards(summary.results, asOf, new Set(summary.bestCombination.includedPolicyIds));
  const cardResults = cards.map((card) => ({
    card,
    result: summary.results.find((result) => result.policy.id === card.policyId)!,
  }));
  const countedCards = cardResults.filter(({ card }) => card.amount.countsInTotal);
  const extraCards = cardResults.filter(({ card }) => !card.amount.countsInTotal);
  const leadState = cards[0]?.state ?? "eligible";
  const leadCards = cards.filter((card) => card.state === leadState);
  const leadDeadlineDays = leadCards
    .map((card) => card.deadlineDays)
    .filter((days): days is number => days !== null)
    .sort((a, b) => a - b)[0];
  const resultHeadline = leadState === "urgent"
    ? `마감이 가까운 혜택 ${leadCards.length}개`
    : leadState === "check"
      ? `확인 후 받을 수 있는 혜택 ${leadCards.length}개`
      : `바로 신청 가능한 혜택 ${leadCards.length}개`;
  const resultSupport = leadState === "urgent"
    ? leadDeadlineDays === 0 ? "오늘 안에 신청을 준비해주세요" : `${leadDeadlineDays}일 안에 신청해야 해요`
    : null;

  // 정책 카드와 같은 규칙으로 지역을 거른다 — 안 거르면 익산·군산 전용 대출상품이
  // 그 외 지역 사용자에게도 그대로 보인다.
  const loanProducts = loanProductsForRegion(allLoanProducts, listing.region);

  // 중복 제한 때문에 빠진 정책 (F4-5). 조용히 빠지면 왜 합산되지 않았는지 알 수 없다.
  const overlapExcluded = excludedByOverlap(summary.results, summary.bestCombination);

  return (
    <AppShell className="step-in">
      <TopBar backHref="/eligibility" />

      <main className="flex flex-col gap-5 pb-10 pt-3">
        <header>
          <h1 className="text-[21px] font-extrabold leading-[1.4] text-ink-900">
            {resultHeadline}
          </h1>
          {/* 둘째 줄은 마감 임박일 때만 — 금액은 바로 아래 영수증이 말한다(11/18, 같은 금액 반복을 뺐다) */}
          {resultSupport && <p className="mt-0.5 text-sm font-bold text-danger-700">{resultSupport}</p>}
        </header>

      <ResultReceipt
        listing={listing}
        supportAmount={summary.maxSupportAmount}
        finalCost={summary.finalEstimatedHousingCost}
        included={included.map((item) => ({
          ...item,
          // 한 번 주는 지원(이사비 등) — 영수증이 매달 나가는 돈과 한 번 내는 돈을 나눠 쓴다
          oneTime: summary.results.find((r) => r.policy.id === item.id)?.policy.benefitType === "lump_sum",
        }))}
        overlapExcluded={overlapExcluded}
        unknownConditions={unknownConditions}
      />

      {/* 11/18 진단 2회차: 합계 안 · 밖이 눈으로 구분되지 않았다 — 보이는 제목으로 나누고, 밖 묶음의 공통 설명은 한 번만 */}
      {countedCards.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="counted-heading">
          <h2 id="counted-heading" className="px-1 text-base font-bold text-ink-900">
            위 금액에 넣은 지원 {countedCards.length}개
          </h2>
          {countedCards.map(({ card, result }, index) => (
            <div key={card.policyId} className="stagger-in" style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }}>
              <BenefitResultCard card={card} result={result} listing={listing} />
            </div>
          ))}
        </section>
      )}

      {extraCards.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="extra-heading">
          <div className="px-1">
            <h2 id="extra-heading" className="text-base font-bold text-ink-900">
              조건이 맞으면 더 받을 수 있는 지원 {extraCards.length}개
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              위 금액에는 넣지 않았어요. 전입 · 재학처럼 계약 조건과 따로 정해지는 지원이라, 자격은 신청 준비에서 확인해요.
            </p>
          </div>
          {extraCards.map(({ card, result }, index) => (
            <div key={card.policyId} className="stagger-in" style={{ animationDelay: `${Math.min((countedCards.length + index) * 45, 225)}ms` }}>
              <BenefitResultCard card={card} result={result} listing={listing} />
            </div>
          ))}
        </section>
      )}

      {/* 대출·보증은 현금 지원이 아니라 합계에 넣지 않는다. 예전엔 7개가 문단째 펼쳐져 화면의 절반을 썼다
          (11/17 결과 화면 정리) — 한 줄로 접고, 펼치면 이름 · 종류 · 확인일만, 상품마다 다시 펼쳐 조건과 신청. */}
      {loanProducts.length > 0 && (
        <section aria-labelledby="loan-heading">
          <h2 id="loan-heading" className="sr-only">대출·보증 상품</h2>
          {/* 안쪽 상품 토글(Disclosure)도 group-open 으로 화살표를 돌린다 — 바깥은 이름 붙은 group 으로 따로 둔다 */}
          <details className="group/loans rounded-card bg-surface shadow-card">
            <summary className="focus-ring flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 [&::-webkit-details-marker]:hidden">
              {/* 묶음의 주제는 3D 그림, 펼치기는 선 화살표 — 같은 줄에서도 할 일이 나뉜다 (lib/icons3d.ts) */}
              <Icon3D name="loan" size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">현금 지원이 아닌 대출·보증 {loanProducts.length}개</span>
                <span className="block text-xs text-ink-500">위 금액에는 넣지 않았어요</span>
              </span>
              <ChevronDown size={ICON_SM} aria-hidden="true" className="shrink-0 text-ink-500 transition-transform group-open/loans:rotate-180" />
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs leading-relaxed text-ink-600">
                이자 절감액은 계산하지 않아요. 자격과 한도는 취급 기관에서 꼭 확인하세요.
              </p>
              <ul className="mt-1 divide-y divide-ink-100">
                {loanProducts.map((product) => (
                  <li key={product.id} className="py-3">
                    <p className="text-sm font-bold text-ink-900">{product.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {product.agency} · {PRODUCT_TYPE_LABEL[product.productType]}
                      {product.verifiedAt ? ` · ${formatDotDate(product.verifiedAt)} 확인` : " · 원문 확인 필요"}
                    </p>
                    <Disclosure label="조건과 신청 방법" className="mt-2">
                      <p className="px-1 text-sm leading-relaxed text-ink-600">{product.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-4 px-1 text-sm">
                        <ExternalRefLink href={product.sourceUrl} tone="quiet">
                          공식 출처
                        </ExternalRefLink>
                        <ExternalRefLink href={product.applyUrl}>신청 페이지로 이동</ExternalRefLink>
                      </div>
                      <ContactInfo contact={product.contact} variant="inline" />
                    </Disclosure>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>
      )}

      <div className="flex gap-2.5 rounded-card bg-ink-100 p-4">
        <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
        <p className="text-xs leading-relaxed text-ink-600">
        최대 지원 가능액은 입력한 값으로 조건을 모두 충족할 때 받을 수 있는 상한을 계산한 거예요. 실제
        소득인정액, 제출 서류, 예산 상황에 따라 더 적거나 없을 수 있고, 최종 자격과 지급액은 해당 기관이
        정해요.
        <br />
        결과 기준일 {formatDotDate(asOf)}
        </p>
      </div>

      {/* 방 두 개를 비교하려면 월세 · 보증금만 바꿔 다시 봐야 한다 — 계약 조건 첫 단계(저장된 값이 채워져 있다) (11/19) */}
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => router.push("/calculate?s=1")}>
          다른 방으로 다시 계산하기
        </Button>
        <Button variant="quiet" onClick={() => router.push("/eligibility?g=1")}>
          답변 수정하기
        </Button>
      </div>
      </main>
    </AppShell>
  );
}

/** 외부로 나가는 링크. 44px 타깃과 새 창 아이콘을 한 곳에서 준다. */
function ExternalRefLink({
  href,
  tone = "brand",
  children,
}: {
  href: string;
  tone?: "brand" | "quiet";
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-bold underline transition-colors ${
        tone === "quiet" ? "text-ink-600 hover:text-ink-900" : "text-brand-700 hover:text-brand-800"
      }`}
    >
      {children}
      <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
    </a>
  );
}
