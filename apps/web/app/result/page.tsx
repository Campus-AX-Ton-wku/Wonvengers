"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import type { LoanProductMeta } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { excludedByOverlap } from "@/lib/combinations";
import { loanProductsForRegion } from "@/lib/region";
import { formatDotDate } from "@/lib/date";
import {
  AppShell,
  BottomTabBar,
  Button,
  Icon3D,
  TopBar,
} from "@/app/components";
import {
  ChevronRight,
  ICON_MD,
  ICON_SM,
  Info,
} from "@/app/components/icons";
import { useResultData } from "./useResultData";
import MissingInput from "./MissingInput";
import BenefitResultCard from "./BenefitResultCard";
import { ResultReceipt } from "./ResultReceipt";
import { ResultLoading, ResultState } from "./ResultState";
import { benefitResultCards } from "@/lib/benefit-result";
import { takeReveal } from "@/lib/reveal";
import FoundReveal from "./FoundReveal";

const allLoanProducts = loanProductsData as LoanProductMeta[];

export default function ResultPage() {
  const router = useRouter();
  const { listing, birthDate, summary, asOf, status, expiredAt, retry } = useResultData();

  // 결과 화면 앞 '찾았어요' 한 장 (11/23 시안). 판정 질문의 [결과 확인하기]가 남긴 표시를 한 번 꺼내 지운다 —
  // 새로고침 · 뒤로 가기 · 홈의 '계산 결과 보기'로 다시 열면 표시가 없어 바로 결과다.
  // ref 에 담는 이유: 개발 모드(StrictMode)는 effect 를 두 번 돌리는데, 두 번째 꺼내기는 늘 false 다.
  const tookReveal = useRef<boolean | null>(null);
  const [revealRequested, setRevealRequested] = useState<boolean | null>(null);
  /** cover: 파란 막만 · leaving: 막이 걷히며 결과를 밑에 깐다 · done: 막 없음 */
  const [revealPhase, setRevealPhase] = useState<"cover" | "leaving" | "done">("cover");
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (tookReveal.current === null) tookReveal.current = takeReveal();
    setRevealRequested(tookReveal.current);
  }, []);
  // 막이 걷히면 결과 제목에 초점 — 화면 읽기가 '찾았어요' 다음에 결과 제목부터 읽는다(시안 노트)
  useEffect(() => {
    if (revealRequested && revealPhase === "done") titleRef.current?.focus({ preventScroll: true });
  }, [revealRequested, revealPhase]);

  if (status === "loading" || revealRequested === null) return <ResultLoading />;
  if (status === "missing") return <MissingInput />;
  if (status === "error") return <ResultState kind="error" onRetry={retry} />;
  if (status === "empty") return <ResultState kind="empty" />;
  if (status === "expired") return <ResultState kind="expired" endDate={expiredAt} />;
  if (!listing || !summary) {
    return <ResultState kind="error" onRetry={retry} />;
  }

  const { included, pending } = summaryHighlights(summary);
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

  // 받을 수 있는 게 없으면(빈 화면 · 만료 화면) 막 없이 그 화면이 바로 나온다 — 위에서 이미 돌아갔다.
  const fromReveal = revealRequested && cards.length > 0;
  const showReveal = fromReveal && revealPhase !== "done";

  const content = (
    <AppShell>
      <TopBar backHref="/eligibility" />

      {/* 등장 애니메이션은 main 에만 — AppShell 에 걸면 그 안의 상단바(sticky) · 하단 섬(fixed)이 iOS 에서 본문과 같이 스크롤된다 (11/20) */}
      {/* '찾았어요'에서 넘어오면 오른쪽에서 밀려오는 대신 아래에서 떠오른다(시안 '페이드') */}
      <main className={`${fromReveal ? "reveal-result-in" : "step-in"} flex flex-col gap-5 pb-10 pt-3`}>
        <header>
          {/* 제목 위 작은 머리글 — 계산 중 · 다시 계산 화면(ResultState)과 같은 말 (시안 '계산 결과', 11/20) */}
          <p className="text-[13px] font-bold text-ink-500">맞춤 혜택 결과</p>
          <h1 ref={titleRef} tabIndex={-1} className="mt-1 text-[21px] font-extrabold leading-[1.4] text-ink-900 outline-none">
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
        pending={pending}
      />

      {/* 11/18 진단 2회차: 합계 안 · 밖이 눈으로 구분되지 않았다 — 보이는 제목으로 나누고, 밖 묶음의 공통 설명은 한 번만 */}
      {countedCards.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="counted-heading">
          <h2 id="counted-heading" className="px-1 text-base font-bold text-ink-900">
            위 금액에 넣은 지원 {countedCards.length}개
          </h2>
          {countedCards.map(({ card, result }, index) => (
            <div key={card.policyId} className="stagger-in" style={{ animationDelay: `${Math.min(index * 45, 225)}ms` }}>
              <BenefitResultCard card={card} result={result} listing={listing} birthDate={birthDate} />
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
              위 금액에는 넣지 않았어요. 아직 확인할 조건이 남았거나, 전입 · 재학처럼 계약 조건과 따로 정해지는 지원이에요.
            </p>
          </div>
          {extraCards.map(({ card, result }, index) => (
            <div key={card.policyId} className="stagger-in" style={{ animationDelay: `${Math.min((countedCards.length + index) * 45, 225)}ms` }}>
              <BenefitResultCard card={card} result={result} listing={listing} birthDate={birthDate} />
            </div>
          ))}
        </section>
      )}

      {/* 대출 · 보증은 현금 지원이 아니라 합계에 넣지 않는다. 11/22 부터 홈 '대출 · 보증' · /loans 가 맡아서
          여기엔 개수와 '합계에 안 넣었다'는 한 줄만 둔다(예전엔 접힌 목록 · 상품별 접기). */}
      {loanProducts.length > 0 && (
        <Link
          href="/loans"
          className="focus-ring flex min-h-16 items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card transition-colors hover:bg-ink-50"
        >
          <Icon3D name="loan" size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink-900">현금 지원이 아닌 대출·보증 {loanProducts.length}개</span>
            <span className="block text-xs text-ink-500">위 금액에는 넣지 않았어요</span>
          </span>
          <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-500" />
        </Link>
      )}

      <div className="flex gap-2.5 rounded-card bg-ink-100 p-4">
        <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
        <p className="text-xs leading-relaxed text-ink-600">
        최대 지원 가능액은 입력한 값으로 조건을 모두 충족했을 때의 상한이에요. 소득인정액·서류·예산에
        따라 더 적거나 없을 수 있어요.
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
      {/* 결과는 홈의 하위 화면 — 하단 섬은 '홈'에 불 (11/21 계산 탭을 달력 탭으로 바꿈) */}
      <BottomTabBar active="home" />
    </AppShell>
  );

  // 같은 자리에 두어 막이 걷힌 뒤 결과 화면이 다시 마운트되지 않게 한다(등장 움직임이 두 번 돌지 않게)
  return (
    <>
      {(!showReveal || revealPhase === "leaving") && content}
      {showReveal && (
        <FoundReveal
          count={cards.length}
          leadState={leadState}
          onLeave={() => setRevealPhase("leaving")}
          onDone={() => setRevealPhase("done")}
        />
      )}
    </>
  );
}
