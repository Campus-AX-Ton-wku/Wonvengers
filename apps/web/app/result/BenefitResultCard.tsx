import Link from "next/link";
import { formatDotDate } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import { benefitFormula } from "@/lib/benefit";
import { formatDeadline, type BenefitResultCardData } from "@/lib/benefit-result";
import type { ListingInput, PolicyResult } from "@/lib/types";
import { ExternalLink, ICON_SM } from "@/app/components/icons";
import { Disclosure, StatusBadge, buttonClass } from "@/app/components";

const STATE_COPY = {
  eligible: { label: "신청 가능", tone: "ok" as const },
  check: { label: "확인 필요", tone: "warn" as const },
  urgent: { label: "마감 임박", tone: "danger" as const },
};

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function DestinationLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  if (isExternal(href)) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

/**
 * 결과 카드 — 공식 Figma Benefit Result Card(104:56)에서 출발해 11/17 에 덜어냈다
 * (.impeccable/critique 진단: 카드마다 같은 사실을 4~6번 말하고, 정책 하나가 상자 9개를 썼다).
 *
 * 남긴 것과 순서: 상태 배지(마감 임박이면 옆에 마감일) → 이름 · 기관 → 금액(지급 방식 한 줄) → 빠진 정보(확인 필요만)
 * → 다음 행동 하나 → 자세히(요건 · 계산식) → 출처 · 대조일.
 * 뺀 것: 우상단 "조건 N개 일치/확인", 신청 가능 카드의 "내 조건과 잘 맞아요" 상자,
 * 자격 요건 · 지원 형태 · 신청 방식 행(배지 · 금액 · 버튼과 같은 말), '검수 상태' 토글(출처 줄의 대조일).
 *
 * 금색은 맨 위 합계에 들어간 금액에만 쓴다(PRODUCT.md "accent 는 금액에만"). 합계에 없는 공고 금액을
 * 같은 금색 상자에 두면 카드 금액을 모두 더한 만큼 받는다고 읽힌다 — 그런 금액은 잉크색으로, 왜 빠졌는지 함께.
 */
export default function BenefitResultCard({
  card,
  result,
  listing,
}: {
  card: BenefitResultCardData;
  result: PolicyResult;
  listing: ListingInput;
}) {
  const state = STATE_COPY[card.state];
  const amountText = `${card.amount.isMaximum ? "최대 " : ""}${formatKoreanMoney(card.amount.value)}`;
  const amountLabel = card.amount.countsInTotal
    ? card.state === "check" ? "확인 후 받을 수 있는 예상 금액" : "받을 수 있는 예상 금액"
    : "공고상 금액";
  const deadlineMeta =
    card.state === "urgent" && card.deadlineAt && card.deadlineDays !== null
      ? `${formatDeadline(card.deadlineAt)} 마감 · ${card.deadlineDays === 0 ? "오늘" : `D-${card.deadlineDays}`}`
      : null;

  return (
    <article className="rounded-card bg-surface p-4 shadow-card" aria-labelledby={`benefit-${card.policyId}`}>
      <div className="flex min-h-[30px] items-center justify-between gap-3">
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
        {deadlineMeta && <p className="text-right text-xs font-bold text-danger-700">{deadlineMeta}</p>}
        <span className="sr-only">{result.status}</span>
      </div>

      <div className="mt-3">
        <h3 id={`benefit-${card.policyId}`} className="line-clamp-3 text-[19px] font-extrabold leading-[1.4] text-ink-900">
          {card.title}
        </h3>
        <p className="mt-1 text-xs text-ink-500">{card.agency}</p>
      </div>

      {card.amount.countsInTotal ? (
        <div className="mt-4 rounded-control bg-accent-50 px-4 py-3.5">
          <p className="text-xs font-bold text-ink-600">{amountLabel}</p>
          <p
            className="mt-1 text-[26px] font-extrabold leading-tight text-accent-700 tabular-nums"
            aria-label={`${amountLabel}, ${amountText}, ${card.amount.period}`}
          >
            {amountText}
          </p>
          <p className="mt-1 text-xs text-ink-600">{card.amount.period}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-control bg-ink-50 px-4 py-3">
          <p className="text-xs font-bold text-ink-600">{amountLabel}</p>
          <p
            className="mt-0.5 text-lg font-extrabold leading-tight text-ink-900 tabular-nums"
            aria-label={`${amountLabel}, ${amountText}, ${card.amount.note}, ${card.amount.period}`}
          >
            {amountText}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            {card.amount.note}
            <span className="block text-ink-500">{card.amount.period}</span>
          </p>
        </div>
      )}

      {card.state === "check" && (
        <div className="mt-3 rounded-[14px] bg-warn-50 px-3.5 py-3">
          <p className="text-sm font-bold text-warn-800">{card.evidence.missingCount}가지 정보가 더 필요해요</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">{card.evidence.message}</p>
        </div>
      )}

      <DestinationLink
        href={card.primaryAction.href}
        className={`${buttonClass({ variant: card.primaryAction.kind === "prepare" ? "primary" : "secondary", size: "md" })} mt-3 min-h-[50px]`}
      >
        {card.primaryAction.label}
      </DestinationLink>

      <Disclosure label="요건과 계산 방법 보기">
        <RequirementList title="충족" items={result.passedLabels} tone="text-ok-700" />
        <RequirementList title="확인 필요" items={result.unknownLabels} tone="text-warn-800" />
        <RequirementList title="미충족" items={result.failedLabels} tone="text-ink-600" />
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-600">{benefitFormula(result.policy, listing)}</p>
        <p className="mt-2 px-1 text-xs text-ink-500">{result.policy.effectiveYear}년 공고 기준</p>
      </Disclosure>

      <a
        href={card.source.url}
        target="_blank"
        rel="noreferrer"
        className="focus-ring mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-control px-2 text-center text-xs font-medium text-ink-600 underline"
        aria-label={`${card.source.name} 공식 출처 새 창에서 열기`}
      >
        공식 출처 · {card.source.name}
        {card.source.updatedAt ? ` · ${formatDotDate(card.source.updatedAt)} 대조` : " · 원문 확인 필요"}
        <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
      </a>
    </article>
  );
}

function RequirementList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className={`text-sm font-bold ${tone}`}>{title}</p>
      <ul className="mt-1 list-disc pl-4 text-sm leading-relaxed text-ink-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
