"use client";

import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import exampleListingsData from "@/data/example-listings.json";
import type { ExampleListing, ListingInput, LoanProductMeta, PolicyResult, PolicyStatus } from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { benefitFormula, benefitTypeLabel, payoutTiming } from "@/lib/benefit";
import { excludedByOverlap } from "@/lib/combinations";
import { exampleBadge, isVerifiedExample } from "@/lib/examples";
import { corroborate } from "@/lib/youth-index";
import { ResultAppBar } from "../Stepper";
import Disclosure from "@/app/Disclosure";
import { YouthBadge, YouthDetails, youthSummaryLabel } from "@/app/YouthCorroboration";
import { useResultData } from "./useResultData";
import MissingInput from "./MissingInput";

const loanProducts = loanProductsData as LoanProductMeta[];
const exampleListings = exampleListingsData as ExampleListing[];

const STATUS_ORDER: PolicyStatus[] = ["예상적용", "조건충족시가능", "대상아님", "신청불가"];
/* sand-200 위 글씨는 대비가 모자란다 (ink-600 4.27:1, ink-500 3.94:1 — 본문 기준 4.5:1 미달).
   design-tokens.md 의 '해당 없음' 태그 규격대로 ink-100 면으로 바꾼다
   (ink-700 5.75:1, ink-600 4.76:1). sand-200 은 구분선·진행 바 트랙 전용이다. */
const STATUS_STYLE: Record<PolicyStatus, string> = {
  예상적용: "bg-ok-50 text-ok-700",
  조건충족시가능: "bg-warn-50 text-warn-800",
  대상아님: "bg-ink-100 text-ink-700",
  신청불가: "bg-ink-100 text-ink-600",
};

export default function ResultPage() {
  const router = useRouter();
  const { listing, summary, asOf, status } = useResultData();

  if (status === "missing") return <MissingInput />;
  if (!listing || !summary) {
    return <main className="p-10 text-center text-ink-500">불러오는 중...</main>;
  }

  const { included, unknownConditions } = summaryHighlights(summary);

  const upfrontCash = listing.deposit + (listing.contractType === "연세" ? listing.rentOrYearlyAmount : 0);
  // 중복 제한 때문에 빠진 정책 (F4-5). 조용히 빠지면 왜 합산되지 않았는지 알 수 없다.
  const overlapExcluded = excludedByOverlap(summary.results, summary.bestCombination);
  // 예시 매물로 계산했다면 결과에도 그대로 표시한다 (F1-11). 이 화면은 캡처해서
  // 공유되기 때문에, 가상 조건으로 나온 금액이 실제 사례로 오해되면 안 된다.
  const activeExample = exampleListings.find((e) => e.id === listing.exampleId) ?? null;

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: summary.results.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="step-in mx-auto flex min-h-screen max-w-lg flex-col px-5">
      <ResultAppBar onBack={() => router.push("/eligibility")} />

      <main className="flex flex-col gap-6 pb-10 pt-2">
        <h1 className="text-center text-2xl font-extrabold leading-snug text-ink-900">
          최대 지원 가능액과
          <br />최종 예상 주거비예요
        </h1>

        {activeExample && (
          <p
            className={`rounded-xl p-3 text-xs font-bold leading-relaxed ${
              isVerifiedExample(activeExample)
                ? "bg-ok-50 text-ok-700"
                : "bg-warn-50 text-warn-800"
            }`}
          >
            예시 매물({activeExample.label}) 조건으로 계산한 결과입니다 —{" "}
            {exampleBadge(activeExample)}
          </p>
        )}

      <section className="amount-in rounded-2xl border-2 border-brand-600 bg-brand-50 p-5">
        {/* 받는 돈만 accent 로 띄운다. 아래 '최종 예상 주거비'는 내는 돈이라
            중립색(ink)으로 둔다 — 둘 다 물들이면 "이 색 = 지원금" 신호가 죽는다.
            accent-700 on brand-50 = 6.22:1, accent-600 on brand-50 = 4.76:1 */}
        <p className="text-xs font-semibold text-accent-700">최대 지원 가능액 (12개월 기준)</p>
        <p className="text-3xl font-extrabold text-accent-600 tabular-nums">
          {summary.maxSupportAmount.toLocaleString()}원
        </p>

        <div className="my-3 h-px bg-brand-200" />

        <p className="text-xs font-semibold text-ink-500">최종 예상 주거비 (명목 지출 − 최대 지원 가능액)</p>
        <p className="text-3xl font-extrabold text-ink-900 tabular-nums">
          {summary.finalEstimatedHousingCost.toLocaleString()}원
        </p>
        <p className="mt-1 text-xs text-ink-500">
          명목 총 지출 {summary.nominalTotalCost.toLocaleString()}원 기준
        </p>

        {unknownConditions.length > 0 && (
          <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-warn-800">
            <p className="font-bold">⚠️ 이 금액에는 아직 확인되지 않은 조건이 포함되어 있습니다</p>
            <ul className="mt-1 list-disc pl-4">
              {unknownConditions.map((u, i) => (
                <li key={i}>
                  [{u.policy}] {u.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* F4-5: 어떤 정책을 합쳐서 나온 금액이고, 무엇이 중복 제한으로 빠졌는지. */}
      <section className="rounded-2xl border border-ink-200 bg-white p-4 text-sm">
        <p className="font-bold text-ink-700">
          <span aria-hidden="true">🧩</span>{" "}
          <span>이 금액은 아래 조합으로 계산했습니다</span>
        </p>
        {included.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {included.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-ink-600">
                <span className="text-xs">{item.name}</span>
                <span className="shrink-0 text-xs font-bold text-ink-900 tabular-nums">
                  {item.amount.toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            합산할 수 있는 정책이 없습니다. 아래 목록에서 각 정책의 미충족·확인 필요 조건을 보세요.
          </p>
        )}

        {overlapExcluded.length > 0 && (
          <div className="mt-3 rounded-lg bg-sand-50 p-3">
            <p className="text-xs font-bold text-ink-600">중복 수급이 안 돼서 빠진 정책</p>
            <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-ink-500">
              {overlapExcluded.map((x) => (
                <li key={x.policy.id}>
                  <strong className="text-ink-600">{x.policy.name}</strong> —{" "}
                  {x.conflictsWith.join(" · ")}과(와) 중복 수급할 수 없어, 금액이 더 큰 쪽만
                  넣었습니다.
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-4 text-sm">
        <p className="font-bold text-ink-700">
          <span aria-hidden="true">💳</span> 계약 시 필요한 목돈과 지급 시점은 다릅니다
        </p>
        <p className="mt-1 text-ink-500">
          계약 당일 필요한 현금: <strong>{upfrontCash.toLocaleString()}원</strong> (보증금
          {listing.contractType === "연세" ? " + 연세 선납액" : ""})
        </p>
        <p className="mt-1 text-ink-500">
          월 단위 지원금은 계약 이후 매월 나눠 지급되며, 계약 당일 필요한 목돈을 줄여주지 않습니다.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {grouped.map((group) => (
          <div key={group.status}>
            <h2 className="mb-2 text-sm font-bold text-ink-500">
              {group.status} ({group.items.length})
            </h2>
            <div className="flex flex-col gap-3">
              {group.items.map((r, i) => (
                <div
                  key={r.policy.id}
                  className="stagger-in"
                  style={{ animationDelay: `${Math.min(i * 45, 225)}ms` }}
                >
                  <PolicyCard result={r} listing={listing} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-500">
            <span aria-hidden="true">🏦</span> 이용 가능한 대출·보증 상품 ({loanProducts.length})
          </h2>
          <p className="mt-1 text-[11px] text-ink-500">
            아래는 현금 지원금이 아닌 대출·보증료 상품입니다. 이자 절감액을 계산하지 않으며, 위 "최대
            지원 가능액"에도 포함되지 않습니다 — 대출과 지원금을 같은 금액으로 섞으면 실제보다 많이
            받는 것처럼 보일 수 있기 때문입니다. 자격·한도는 안내일 뿐이니 정확한 조건은 취급 기관에
            문의하세요.
          </p>
        </div>
        {loanProducts.map((product) => (
          <div key={product.id} className="rounded-2xl border border-ink-200 bg-sand-50 p-4">
            <p className="text-sm font-bold text-ink-900">{product.name}</p>
            <p className="text-xs text-ink-500">{product.agency} · {product.regionScope}</p>
            <p className="mt-2 text-xs text-ink-500">{product.summary}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink-500 underline">
                공식 출처
              </a>
              <a href={product.applyUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                신청 페이지로 이동
              </a>
            </div>
            <Disclosure label="검수 상태 · 참고사항">
              <p className="text-[11px] text-ink-500">
                {product.effectiveYear}년 기준 ·{" "}
                {product.verifiedAt ? `${product.verifiedAt} 확인` : "팀 교차검수 전 (미검증 초안)"}
              </p>
              {product.notes && (
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{product.notes}</p>
              )}
            </Disclosure>
          </div>
        ))}
      </section>

      <p className="rounded-xl bg-ink-100 p-4 text-xs leading-relaxed text-ink-500">
        최대 지원 가능액은 입력값을 바탕으로 조건 충족 시 받을 수 있는 상한을 계산한 값입니다. 실제
        소득인정액, 제출 서류, 예산 상황 등에 따라 지원액이 더 적거나 없을 수 있으며 최종 자격과
        지급액은 해당 기관이 결정합니다.
        <br />
        결과 기준일: {asOf}
      </p>

      <button
        onClick={() => router.push("/eligibility")}
        className="rounded-xl border border-ink-200 py-3 text-sm font-bold text-ink-600 transition-colors hover:border-ink-500 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        답변 수정하기
      </button>
    </main>
    </div>
  );
}

function PolicyCard({ result, listing }: { result: PolicyResult; listing: ListingInput }) {
  const { policy } = result;
  // 대상아님·신청불가는 받을 금액이 없으니 산식을 보여주면 오해를 준다.
  const showFormula = result.status === "예상적용" || result.status === "조건충족시가능";
  // 정부 청년정책 DB 대조. 판정·금액에는 쓰지 않고 출처 확인용으로만 보여준다.
  const youth = corroborate(policy);
  // 1층 카드와 같은 시맨틱 — 카드 하나가 그 자체로 완결된 항목이다.
  return (
    <article className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink-900">{policy.name}</p>
          <p className="text-xs text-ink-500">{policy.agency} · {policy.regionScope}</p>
          <div className="mt-1.5">
            <YouthBadge state={youth.state} />
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLE[result.status]}`}>
          {result.status}
        </span>
      </div>

      {/* F4-3: 지원 형태 · 지급 시점 · 적용 산식 · 총 예상액 */}
      <p className="mt-2 text-xs font-semibold text-ink-600">
        {benefitTypeLabel(policy.benefitType)} · {payoutTiming(policy)}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">{policy.benefitSummary}</p>

      {showFormula && (
        <div className="mt-2 rounded-lg bg-sand-50 p-2.5">
          <p className="text-sm font-bold text-brand-900">
            이 정책 단독 예상액: {result.estimatedAmount.toLocaleString()}원
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
            {benefitFormula(policy, listing)}
          </p>
        </div>
      )}

      {/* 요건 목록은 정책마다 6~8줄이라 다 펼치면 화면을 다 먹는다. 라벨에 건수를 적는다. */}
      <Disclosure label={`요건 자세히 보기 · ${requirementCounts(result)}`}>
        {result.passedLabels.length > 0 && (
          <RequirementList title="충족" items={result.passedLabels} tone="text-ok-700" />
        )}
        {result.unknownLabels.length > 0 && (
          <RequirementList title="확인 필요" items={result.unknownLabels} tone="text-warn-800" />
        )}
        {result.failedLabels.length > 0 && (
          <RequirementList title="미충족" items={result.failedLabels} tone="text-ink-500" />
        )}
        {result.passedLabels.length +
          result.unknownLabels.length +
          result.failedLabels.length ===
          0 && (
          <p className="text-xs text-ink-500">
            신청 기간이 아니라 요건을 판정하지 않았습니다.
          </p>
        )}
      </Disclosure>

      {/* 정부 청년정책 DB(온통청년)에 같은 정책이 어떻게 등록되어 있는지. 출처 확인용이다. */}
      <Disclosure label={youthSummaryLabel(youth)}>
        <YouthDetails policy={policy} youth={youth} />
      </Disclosure>

      {/* 검수 메모는 팀이 공고와 대조한 기록이다. 사용자가 볼 값이긴 하지만 길다. */}
      <Disclosure label="검수 상태 · 참고사항">
        <p className="text-[11px] text-ink-500">
          {policy.effectiveYear}년 기준 ·{" "}
          {policy.verifiedAt ? `${policy.verifiedAt} 확인` : "팀 교차검수 전 (미검증 초안)"}
        </p>
        {policy.notes && (
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{policy.notes}</p>
        )}
      </Disclosure>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <a href={policy.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink-500 underline">
          공식 출처
        </a>
        <a href={policy.applyUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
          신청 페이지로 이동
        </a>
      </div>
    </article>
  );
}

/** 토글을 열지 않고도 안에 뭐가 있는지 알 수 있게 라벨에 넣는 건수. 0건은 적지 않는다. */
function requirementCounts(result: PolicyResult): string {
  const parts = [
    result.passedLabels.length > 0 ? `충족 ${result.passedLabels.length}` : null,
    result.unknownLabels.length > 0 ? `확인 필요 ${result.unknownLabels.length}` : null,
    result.failedLabels.length > 0 ? `미충족 ${result.failedLabels.length}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "판정하지 않음";
}

function RequirementList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="mt-2">
      <p className={`text-xs font-bold ${tone}`}>{title}</p>
      <ul className="mt-1 list-disc pl-4 text-xs text-ink-500">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
