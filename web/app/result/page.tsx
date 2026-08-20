"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import loanProductsData from "@/data/loan-products.json";
import type { ListingInput, LoanProductMeta, PolicyMeta, PolicyResult, PolicyStatus } from "@/lib/types";
import { buildCalculationSummary } from "@/lib/summary";
import { loadListing, loadProfile } from "@/lib/storage";
import { policiesForRegion } from "@/lib/region";
import { ResultAppBar } from "../Stepper";

const policies = policiesData as PolicyMeta[];
const loanProducts = loanProductsData as LoanProductMeta[];

const STATUS_ORDER: PolicyStatus[] = ["예상적용", "조건충족시가능", "대상아님", "신청불가"];
const STATUS_STYLE: Record<PolicyStatus, string> = {
  예상적용: "bg-ok-50 text-ok-700",
  조건충족시가능: "bg-warn-50 text-warn-800",
  대상아님: "bg-sand-200 text-ink-600",
  신청불가: "bg-sand-200 text-ink-500",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ResultPage() {
  const router = useRouter();
  const [listing, setListing] = useState<ListingInput | null>(null);
  const [asOf] = useState(todayISO());

  useEffect(() => {
    const savedListing = loadListing();
    const savedProfile = loadProfile();
    if (!savedListing || !savedProfile) {
      router.replace("/");
      return;
    }
    setListing(savedListing);
  }, [router]);

  const profile = loadProfile();

  const summary = useMemo(() => {
    if (!listing || !profile) return null;
    // 판정질문 화면과 같은 후보 집합을 써야 한다. 여기서 지역 밖 정책을 같이 빼지 않으면
    // 묻지 않은 질문이 unknown 으로 남아 그 정책이 '조건충족시가능'으로 잘못 뜬다.
    const scoped = policiesForRegion(policies, listing.region);
    return buildCalculationSummary(scoped, profile, listing, asOf);
  }, [listing, profile, asOf]);

  if (!listing || !profile || !summary) {
    return <main className="p-10 text-center text-ink-500">불러오는 중...</main>;
  }

  const includedResults = summary.results.filter((r) =>
    summary.bestCombination.includedPolicyIds.includes(r.policy.id)
  );
  const unknownFromIncluded = includedResults
    .filter((r) => r.status === "조건충족시가능")
    .flatMap((r) => r.unknownLabels.map((label) => ({ policy: r.policy.name, label })));

  const upfrontCash = listing.deposit + (listing.contractType === "연세" ? listing.rentOrYearlyAmount : 0);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: summary.results.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5">
      <ResultAppBar onBack={() => router.push("/eligibility")} />

      <main className="flex flex-col gap-6 pb-10 pt-2">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">
          최대 지원 가능액과
          <br />최종 예상 주거비예요
        </h1>

      <section className="rounded-2xl border-2 border-brand-600 bg-brand-50 p-5">
        <p className="text-xs font-semibold text-brand-900">최대 지원 가능액 (12개월 기준)</p>
        <p className="text-3xl font-extrabold text-brand-900">
          {summary.maxSupportAmount.toLocaleString()}원
        </p>

        <div className="my-3 h-px bg-brand-200" />

        <p className="text-xs font-semibold text-ink-500">최종 예상 주거비 (명목 지출 − 최대 지원 가능액)</p>
        <p className="text-3xl font-extrabold text-ink-900">
          {summary.finalEstimatedHousingCost.toLocaleString()}원
        </p>
        <p className="mt-1 text-xs text-ink-500">
          명목 총 지출 {summary.nominalTotalCost.toLocaleString()}원 기준
        </p>

        {unknownFromIncluded.length > 0 && (
          <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-warn-800">
            <p className="font-bold">⚠️ 이 금액에는 아직 확인되지 않은 조건이 포함되어 있습니다</p>
            <ul className="mt-1 list-disc pl-4">
              {unknownFromIncluded.map((u, i) => (
                <li key={i}>
                  [{u.policy}] {u.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-4 text-sm">
        <p className="font-bold text-ink-700">계약 시 필요한 목돈과 지급 시점은 다릅니다</p>
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
              {group.items.map((r) => (
                <PolicyCard key={r.policy.id} result={r} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-500">이용 가능한 대출·보증 상품 ({loanProducts.length})</h2>
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
            <p className="mt-2 text-[11px] text-ink-500">
              {product.effectiveYear}년 기준 · {product.verifiedAt ? `${product.verifiedAt} 확인` : "팀 교차검수 전 (미검증 초안)"}
            </p>
            {product.notes && <p className="mt-1 text-[11px] text-ink-500">{product.notes}</p>}
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
        className="rounded-xl border border-ink-200 py-3 text-sm font-bold text-ink-600"
      >
        답변 수정하기
      </button>
    </main>
    </div>
  );
}

function PolicyCard({ result }: { result: PolicyResult }) {
  const { policy } = result;
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink-900">{policy.name}</p>
          <p className="text-xs text-ink-500">{policy.agency} · {policy.regionScope}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLE[result.status]}`}>
          {result.status}
        </span>
      </div>

      <p className="mt-2 text-xs text-ink-500">{policy.benefitSummary}</p>

      {result.estimatedAmount > 0 && (
        <p className="mt-1 text-sm font-bold text-brand-900">
          이 정책 단독 예상액: {result.estimatedAmount.toLocaleString()}원
        </p>
      )}

      {result.passedLabels.length > 0 && (
        <RequirementList title="충족" items={result.passedLabels} tone="text-ok-700" />
      )}
      {result.unknownLabels.length > 0 && (
        <RequirementList title="확인 필요" items={result.unknownLabels} tone="text-warn-800" />
      )}
      {result.failedLabels.length > 0 && (
        <RequirementList title="미충족" items={result.failedLabels} tone="text-ink-500" />
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <a href={policy.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-ink-500 underline">
          공식 출처
        </a>
        <a href={policy.applyUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
          신청 페이지로 이동
        </a>
      </div>

      <p className="mt-2 text-[11px] text-ink-500">
        {policy.effectiveYear}년 기준 · {policy.verifiedAt ? `${policy.verifiedAt} 확인` : "팀 교차검수 전 (미검증 초안)"}
      </p>
      {policy.notes && <p className="mt-1 text-[11px] text-ink-500">{policy.notes}</p>}
    </div>
  );
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
