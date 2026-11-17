"use client";

import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import type { LoanProductMeta } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { formatKoreanMoney } from "@/lib/money";
import { excludedByOverlap } from "@/lib/combinations";
import { loanProductsForRegion } from "@/lib/region";
import { formatDotDate } from "@/lib/date";
import {
  AppShell,
  Button,
  ContactInfo,
  Disclosure,
  ResultSummary,
  TopBar,
} from "@/app/components";
import {
  ChevronDown,
  ExternalLink,
  ICON_MD,
  ICON_SM,
  Info,
  Landmark,
  ListChecks,
  Wallet,
} from "@/app/components/icons";
import { useResultData } from "./useResultData";
import MissingInput from "./MissingInput";
import BenefitResultCard from "./BenefitResultCard";
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
    : leadState === "check"
      ? summary.maxSupportAmount > 0 ? `확인 후 최대 ${formatKoreanMoney(summary.maxSupportAmount)} 가능` : "자격 조건은 신청 준비에서 확인해요"
      : summary.maxSupportAmount > 0 ? `최대 ${formatKoreanMoney(summary.maxSupportAmount)} 받을 수 있어요` : "신청 전에 공고상 지원 한도를 확인해주세요";

  // 정책 카드와 같은 규칙으로 지역을 거른다 — 안 거르면 익산·군산 전용 대출상품이
  // 그 외 지역 사용자에게도 그대로 보인다.
  const loanProducts = loanProductsForRegion(allLoanProducts, listing.region);

  const upfrontCash = listing.deposit + (listing.contractType === "연세" ? listing.rentOrYearlyAmount : 0);
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
          <p className={`mt-0.5 text-sm font-bold ${leadState === "urgent" ? "text-danger-700" : "text-brand-700"}`}>
            {resultSupport}
          </p>
        </header>

      <ResultSummary
        supportAmount={summary.maxSupportAmount}
        finalCost={summary.finalEstimatedHousingCost}
        nominalTotal={summary.nominalTotalCost}
        unknownConditions={unknownConditions}
      />

      {/* F4-5: 어떤 정책을 합쳐서 나온 금액이고, 무엇이 중복 제한으로 빠졌는지. */}
      <section className="rounded-card bg-surface p-5 text-sm shadow-card">
        <SectionTitle icon={<ListChecks size={ICON_MD} aria-hidden="true" />}>
          이 금액은 아래 조합으로 계산했습니다
        </SectionTitle>
        {included.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {included.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm text-ink-600">
                <span>{item.name}</span>
                <span className="shrink-0 font-bold text-ink-900 tabular-nums">
                  {formatKoreanMoney(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            합산할 수 있는 정책이 없습니다. 아래 목록에서 각 정책의 미충족·확인 필요 조건을 보세요.
          </p>
        )}

        {overlapExcluded.length > 0 && (
          <Disclosure label={`중복 수급으로 빠진 정책 ${overlapExcluded.length}개`}>
            <ul className="flex flex-col gap-2 px-1 text-sm leading-relaxed text-ink-500">
              {overlapExcluded.map((x) => (
                <li key={x.policy.id}>
                  <strong className="text-ink-600">{x.policy.name}</strong> —{" "}
                  {x.conflictsWith.join(" · ")}과(와) 중복 수급할 수 없어, 금액이 더 큰 쪽만
                  넣었습니다.
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </section>

      <section className="rounded-card bg-surface p-5 text-sm shadow-card">
        <SectionTitle icon={<Wallet size={ICON_MD} aria-hidden="true" />}>
          계약 시 필요한 목돈과 지급 시점은 달라요
        </SectionTitle>
        <p className="mt-1 text-ink-500">
          계약 당일 필요한 현금: <strong>{formatKoreanMoney(upfrontCash)}</strong> (보증금
          {listing.contractType === "연세" ? " + 연세 선납액" : ""})
        </p>
        <p className="mt-1 text-ink-500">
          월 단위 지원금은 계약 이후 매월 나눠 지급되며, 계약 당일 필요한 목돈을 줄여주지 않습니다.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="benefit-cards-heading">
        <h2 id="benefit-cards-heading" className="sr-only">맞춤 혜택 {cardResults.length}개</h2>
        {cardResults.map(({ card, result }, index) => (
          <div
            key={card.policyId}
            className="stagger-in"
            style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }}
          >
            <BenefitResultCard card={card} result={result} listing={listing} />
          </div>
        ))}
      </section>

      {/* 대출·보증은 현금 지원이 아니라 합계에 넣지 않는다. 예전엔 7개가 문단째 펼쳐져 화면의 절반을 썼다
          (11/17 결과 화면 정리) — 한 줄로 접고, 펼치면 이름 · 종류 · 확인일만, 상품마다 다시 펼쳐 조건과 신청. */}
      {loanProducts.length > 0 && (
        <section aria-labelledby="loan-heading">
          <h2 id="loan-heading" className="sr-only">대출·보증 상품</h2>
          {/* 안쪽 상품 토글(Disclosure)도 group-open 으로 화살표를 돌린다 — 바깥은 이름 붙은 group 으로 따로 둔다 */}
          <details className="group/loans rounded-card bg-surface shadow-card">
            <summary className="focus-ring flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Landmark size={ICON_MD} aria-hidden="true" />
              </span>
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
        최대 지원 가능액은 입력값을 바탕으로 조건 충족 시 받을 수 있는 상한을 계산한 값입니다. 실제
        소득인정액, 제출 서류, 예산 상황 등에 따라 지원액이 더 적거나 없을 수 있으며 최종 자격과
        지급액은 해당 기관이 결정합니다.
        <br />
        결과 기준일: {asOf}
        </p>
      </div>

      <Button variant="quiet" onClick={() => router.push("/eligibility?g=1")}>
        답변 수정하기
      </Button>
      </main>
    </AppShell>
  );
}

/**
 * 카드 제목 — 원형 면에 아이콘 하나 + 한 줄.
 * 아이콘은 장식이므로 접근성 트리에서 뺀다(호출부에서 aria-hidden).
 */
function SectionTitle({
  icon,
  as: Tag = "p",
  children,
}: {
  icon: React.ReactNode;
  as?: "p" | "h2";
  children: React.ReactNode;
}) {
  return (
    <Tag className="flex items-center gap-3 text-base font-bold text-ink-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span>{children}</span>
    </Tag>
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
