"use client";

import { useRouter } from "next/navigation";
import loanProductsData from "@/data/loan-products.json";
import exampleListingsData from "@/data/example-listings.json";
import type {
  ExampleListing,
  ListingInput,
  LoanProductMeta,
  PolicyResult,
  PolicyStatus,
} from "@/lib/types";
import { summaryHighlights } from "@/lib/summary";
import { benefitFormula, benefitTypeLabel, payoutTiming } from "@/lib/benefit";
import { formatKoreanMoney } from "@/lib/money";
import { excludedByOverlap } from "@/lib/combinations";
import { exampleBadge, isVerifiedExample } from "@/lib/examples";
import {
  AppShell,
  Button,
  Card,
  Disclosure,
  ResultSummary,
  StatusBadge,
  TopBar,
} from "@/app/components";
import type { BadgeTone } from "@/app/components";
import {
  ExternalLink,
  FileText,
  ICON_SM,
  Info,
  Landmark,
  ListChecks,
  Wallet,
} from "@/app/components/icons";
import { useResultData } from "./useResultData";
import MissingInput from "./MissingInput";

const loanProducts = loanProductsData as LoanProductMeta[];
const exampleListings = exampleListingsData as ExampleListing[];

const STATUS_ORDER: PolicyStatus[] = ["예상적용", "조건충족시가능", "대상아님", "신청불가"];

/**
 * 판정 상태 → 배지 톤. 색은 StatusBadge 한 곳에서만 정한다.
 *
 * '신청불가'와 '대상아님'을 나눠 두는 이유: 둘 다 못 받지만 이유가 다르다.
 * 대상아님은 조건이 안 맞는 것이고, 신청불가는 지금 접수 기간이 아닌 것이다.
 */
const STATUS_TONE: Record<PolicyStatus, BadgeTone> = {
  예상적용: "ok",
  조건충족시가능: "warn",
  대상아님: "neutral",
  신청불가: "muted",
};

export default function ResultPage() {
  const router = useRouter();
  const { listing, summary, asOf, status } = useResultData();

  if (status === "missing") return <MissingInput />;
  if (!listing || !summary) {
    return (
      <AppShell>
        <TopBar backHref="/eligibility" backLabel="이전 화면으로" />
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </AppShell>
    );
  }

  const { included, unknownConditions } = summaryHighlights(summary);

  const upfrontCash =
    listing.deposit + (listing.contractType === "연세" ? listing.rentOrYearlyAmount : 0);
  // 중복 제한 때문에 빠진 정책 (F4-5). 조용히 빠지면 왜 합산되지 않았는지 알 수 없다.
  const overlapExcluded = excludedByOverlap(summary.results, summary.bestCombination);
  // 예시 매물로 계산했다면 결과에도 그대로 표시한다 (F1-11). 이 화면은 캡처해서
  // 공유되기 때문에, 가상 조건으로 나온 금액이 실제 사례로 오해되면 안 된다.
  const activeExample = exampleListings.find((e) => e.id === listing.exampleId) ?? null;

  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    items: summary.results.filter((r) => r.status === s),
  })).filter((g) => g.items.length > 0);

  return (
    <AppShell className="step-in">
      <TopBar onBack={() => router.push("/eligibility")} backLabel="이전 화면으로" />

      <main className="flex flex-col gap-5 pb-10 pt-2">
        {/* 아래 카드가 '최대 지원 가능액'·'최종 예상 주거비' 라벨을 이미 단다.
            제목이 같은 말을 반복하면 캡처 한 장에서 같은 문구가 두 번 나오고,
            두 줄이 화면 상단을 먹어 금액 카드가 아래로 밀린다.
            금액은 넣지 않는다 — app/page.tsx 의 MAX_BENEFIT 주석과 같은 태도로,
            확정되지 않은 금액을 가장 큰 약속으로 쓰지 않는다. */}
        <h1 className="text-center text-xl font-extrabold leading-snug text-ink-900">
          내 예상 결과예요
        </h1>

        {activeExample && (
          <p
            className={`flex items-start gap-2 rounded-card p-4 text-xs font-bold leading-relaxed ${
              isVerifiedExample(activeExample)
                ? "bg-ok-50 text-ok-700"
                : "bg-warn-50 text-warn-800"
            }`}
          >
            <Info size={ICON_SM} aria-hidden="true" className="mt-px shrink-0" />
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
        <Card as="section">
          <SectionTitle icon={<ListChecks size={ICON_SM} aria-hidden="true" />}>
            이 금액은 아래 조합으로 계산했습니다
          </SectionTitle>
          {included.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {included.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-xs text-ink-600">{item.name}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-ink-900">
                    {formatKoreanMoney(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              합산할 수 있는 정책이 없습니다. 아래 목록에서 각 정책의 미충족·확인 필요
              조건을 보세요.
            </p>
          )}

          {overlapExcluded.length > 0 && (
            <div className="mt-4 rounded-control bg-ink-50 p-3.5">
              <p className="text-xs font-bold text-ink-600">중복 수급이 안 돼서 빠진 정책</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-ink-500">
                {overlapExcluded.map((x) => (
                  <li key={x.policy.id}>
                    <strong className="font-bold text-ink-700">{x.policy.name}</strong> —{" "}
                    {x.conflictsWith.join(" · ")}과(와) 중복 수급할 수 없어, 금액이 더 큰 쪽만
                    넣었습니다.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card as="section">
          <SectionTitle icon={<Wallet size={ICON_SM} aria-hidden="true" />}>
            계약 시 필요한 목돈과 지급 시점은 다릅니다
          </SectionTitle>
          <p className="mt-2 text-sm text-ink-600">
            계약 당일 필요한 현금:{" "}
            <strong className="font-bold text-ink-900">{formatKoreanMoney(upfrontCash)}</strong>{" "}
            (보증금{listing.contractType === "연세" ? " + 연세 선납액" : ""})
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            월 단위 지원금은 계약 이후 매월 나눠 지급되며, 계약 당일 필요한 목돈을 줄여주지
            않습니다.
          </p>
        </Card>

        <section className="flex flex-col gap-4">
          {grouped.map((group) => {
            const cards = (
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
            );

            /* '대상아님'은 접는다. 받을 수 없는 정책이 목록의 절반을 차지하면 받을 수 있는
               것이 아래로 밀린다. 라벨에 건수를 남기므로 접었다고 값이 사라지지 않는다 —
               왜 대상이 아닌지는 카드를 열면 그대로 있다 (1층 '해당되지 않는 지원금'과 같은 처리). */
            return (
              <div key={group.status}>
                {group.status === "대상아님" ? (
                  <Disclosure label={`${group.status} (${group.items.length})`} className="">
                    {cards}
                  </Disclosure>
                ) : (
                  <>
                    {/* 상태 배지는 카드마다 이미 붙어 있다. 그룹 제목까지 배지로
                        만들면 같은 신호가 화면에 두 겹으로 쌓인다 — 여기는 라벨이다.
                        문구를 `상태 (건수)` 로 두는 것은 '대상아님' 토글 라벨과
                        같은 형태를 유지하기 위한 것이다. */}
                    <h2 className="mb-2 px-1 text-sm font-bold text-ink-500">
                      {group.status} ({group.items.length})
                    </h2>
                    {cards}
                  </>
                )}
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-700">
              <Landmark size={ICON_SM} aria-hidden="true" className="text-ink-500" />
              이용 가능한 대출·보증 상품 ({loanProducts.length})
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
              아래는 현금 지원금이 아닌 대출·보증료 상품입니다. 이자 절감액을 계산하지 않으며,
              위 &ldquo;최대 지원 가능액&rdquo;에도 포함되지 않습니다 — 대출과 지원금을 같은
              금액으로 섞으면 실제보다 많이 받는 것처럼 보일 수 있기 때문입니다. 자격·한도는
              안내일 뿐이니 정확한 조건은 취급 기관에 문의하세요.
            </p>
          </div>
          {loanProducts.map((product) => (
            <Card key={product.id} tone="flat" as="article">
              <p className="text-sm font-bold text-ink-900">{product.name}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {product.agency} · {product.regionScope}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">{product.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <SourceLink href={product.sourceUrl}>공식 출처</SourceLink>
                <ApplyLink href={product.applyUrl} />
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
            </Card>
          ))}
        </section>

        <div className="flex gap-2.5 rounded-card bg-ink-100 p-4">
          <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <p className="text-xs leading-relaxed text-ink-600">
            최대 지원 가능액은 입력값을 바탕으로 조건 충족 시 받을 수 있는 상한을 계산한
            값입니다. 실제 소득인정액, 제출 서류, 예산 상황 등에 따라 지원액이 더 적거나 없을
            수 있으며 최종 자격과 지급액은 해당 기관이 결정합니다.
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

/** 카드 제목 — 아이콘 하나 + 한 줄. 아이콘은 장식이므로 접근성 트리에서 뺀다. */
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
      <span className="text-ink-500">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-xs font-bold text-ink-600 underline transition-colors hover:text-ink-900"
    >
      <FileText size={ICON_SM - 2} aria-hidden="true" />
      {children}
    </a>
  );
}

function ApplyLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-xs font-bold text-brand-700 underline transition-colors hover:text-brand-800"
    >
      신청 페이지로 이동
      <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
    </a>
  );
}

function PolicyCard({ result, listing }: { result: PolicyResult; listing: ListingInput }) {
  const { policy } = result;
  // 대상아님·신청불가는 받을 금액이 없으니 산식을 보여주면 오해를 준다.
  const showFormula = result.status === "예상적용" || result.status === "조건충족시가능";
  // 1층 카드와 같은 시맨틱 — 카드 하나가 그 자체로 완결된 항목이다.
  return (
    <article className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">{policy.name}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {policy.agency} · {policy.regionScope}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[result.status]}>{result.status}</StatusBadge>
      </div>

      {/* F4-3: 지원 형태 · 지급 시점 · 적용 산식 · 총 예상액 */}
      <p className="mt-2.5 text-xs font-semibold text-ink-600">
        {benefitTypeLabel(policy.benefitType)} · {payoutTiming(policy)}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{policy.benefitSummary}</p>

      {showFormula && (
        /* 이 정책 하나가 얼마짜리인지. 위 요약 카드의 금색과 같은 신호를 쓰되
           면은 옅게 둔다 — 여기서 진하게 쓰면 합산 금액보다 커 보인다. */
        <div className="mt-3 rounded-control bg-accent-50 p-3">
          <p className="text-sm font-bold text-accent-700">
            이 정책 단독 예상액: {formatKoreanMoney(result.estimatedAmount)}
          </p>
          {/* 산식은 원 단위로 남긴다. 이 줄의 목적은 공고 원문과 대조하는 검산이고,
              공고가 원 단위로 적혀 있다. 만원으로 바꾸면 대조가 어려워진다. */}
          <p className="mt-1 text-[11px] leading-relaxed text-accent-700/80">
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
        {result.passedLabels.length + result.unknownLabels.length + result.failedLabels.length ===
          0 && <p className="text-xs text-ink-500">신청 기간이 아니라 요건을 판정하지 않았습니다.</p>}
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

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <SourceLink href={policy.sourceUrl}>공고 원문</SourceLink>
        <ApplyLink href={policy.applyUrl} />
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
      <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-ink-500">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden="true" className="text-ink-300">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
