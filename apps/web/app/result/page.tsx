"use client";

import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import exampleListingsData from "@/data/example-listings.json";
import type { ExampleListing, LoanProductMeta } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { formatKoreanMoney } from "@/lib/money";
import { excludedByOverlap } from "@/lib/combinations";
import { exampleBadge, isVerifiedExample } from "@/lib/examples";
import { loanProductsForRegion } from "@/lib/region";
import {
  AppShell,
  Button,
  Disclosure,
  ResultSummary,
  TopBar,
} from "@/app/components";
import {
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
import BenefitResultCard, { BenefitResultDetails } from "./BenefitResultCard";
import { ResultLoading, ResultState } from "./ResultState";
import { benefitResultCards } from "@/lib/benefit-result";

const allLoanProducts = loanProductsData as LoanProductMeta[];
const exampleListings = exampleListingsData as ExampleListing[];

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
  const cards = benefitResultCards(summary.results, asOf);
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
      ? `조건 확인이 필요한 혜택 ${leadCards.length}개`
      : `바로 신청 가능한 혜택 ${leadCards.length}개`;
  const resultSupport = leadState === "urgent"
    ? leadDeadlineDays === 0 ? "오늘 안에 신청을 준비해주세요" : `${leadDeadlineDays}일 안에 신청해야 해요`
    : leadState === "check"
      ? summary.maxSupportAmount > 0 ? `확인 후 최대 ${formatKoreanMoney(summary.maxSupportAmount)} 가능` : "조건을 확인하면 예상 금액을 계산할 수 있어요"
      : summary.maxSupportAmount > 0 ? `최대 ${formatKoreanMoney(summary.maxSupportAmount)} 받을 수 있어요` : "신청 전에 공고상 지원 한도를 확인해주세요";

  // 정책 카드와 같은 규칙으로 지역을 거른다 — 안 거르면 익산·군산 전용 대출상품이
  // 그 외 지역 사용자에게도 그대로 보인다.
  const loanProducts = loanProductsForRegion(allLoanProducts, listing.region);

  const upfrontCash = listing.deposit + (listing.contractType === "연세" ? listing.rentOrYearlyAmount : 0);
  // 중복 제한 때문에 빠진 정책 (F4-5). 조용히 빠지면 왜 합산되지 않았는지 알 수 없다.
  const overlapExcluded = excludedByOverlap(summary.results, summary.bestCombination);
  // 예시 매물로 계산했다면 결과에도 그대로 표시한다 (F1-11). 이 화면은 캡처해서
  // 공유되기 때문에, 가상 조건으로 나온 금액이 실제 사례로 오해되면 안 된다.
  const activeExample = exampleListings.find((e) => e.id === listing.exampleId) ?? null;

  return (
    <AppShell className="step-in">
      <TopBar onBack={() => router.push("/eligibility")} backLabel="이전 화면으로" />

      <main className="flex flex-col gap-5 pb-10 pt-3">
        <header>
          <p className="text-[11px] font-bold text-ink-500">맞춤 혜택 결과</p>
          <h1 className="mt-0.5 text-[21px] font-extrabold leading-[1.4] text-ink-900">
            {resultHeadline}
          </h1>
          <p className={`mt-0.5 text-sm font-bold ${leadState === "urgent" ? "text-danger-700" : "text-brand-700"}`}>
            {resultSupport}
          </p>
        </header>

        {activeExample && (
          <p
            className={`flex items-start gap-2 rounded-card p-4 text-sm font-bold leading-relaxed ${
              isVerifiedExample(activeExample)
                ? "bg-ok-50 text-ok-700"
                : "bg-warn-50 text-warn-800"
            }`}
          >
            <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              예시 매물({activeExample.label}) 조건으로 계산한 결과입니다 —{" "}
              {exampleBadge(activeExample)}
            </span>
          </p>
        )}

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

      <section className="flex flex-col gap-3" aria-label={`맞춤 혜택 ${cardResults.length}개`}>
        {cardResults.map(({ card, result }, index) => (
          <div
            key={card.policyId}
            className="stagger-in"
            style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }}
          >
            <BenefitResultCard card={card} result={result} />
            <div className="mt-2">
              <BenefitResultDetails result={result} listing={listing} />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <SectionTitle as="h2" icon={<Landmark size={ICON_MD} aria-hidden="true" />}>
            이용 가능한 대출·보증 상품 ({loanProducts.length})
          </SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            아래는 현금 지원금이 아닌 대출·보증료 상품입니다. 이자 절감액을 계산하지 않으며, 위 "최대
            지원 가능액"에도 포함되지 않습니다 — 대출과 지원금을 같은 금액으로 섞으면 실제보다 많이
            받는 것처럼 보일 수 있기 때문입니다. 자격·한도는 안내일 뿐이니 정확한 조건은 취급 기관에
            문의하세요.
          </p>
        </div>
        {loanProducts.map((product) => (
          <div key={product.id} className="rounded-card bg-surface p-5 shadow-card">
            <p className="text-base font-bold text-ink-900">{product.name}</p>
            <p className="text-xs text-ink-500">{product.agency} · {product.regionScope}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{product.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <ExternalRefLink href={product.sourceUrl} tone="quiet">
                공식 출처
              </ExternalRefLink>
              <ExternalRefLink href={product.applyUrl}>신청 페이지로 이동</ExternalRefLink>
            </div>
            <Disclosure label="검수 상태 · 참고사항">
              <p className="text-xs text-ink-500">
                {product.effectiveYear}년 기준 ·{" "}
                {product.verifiedAt ? `${product.verifiedAt} 확인` : "팀 교차검수 전 (미검증 초안)"}
              </p>
              {product.notes && (
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{product.notes}</p>
              )}
            </Disclosure>
          </div>
        ))}
      </section>

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

      <Button variant="quiet" onClick={() => router.push("/eligibility")}>
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
