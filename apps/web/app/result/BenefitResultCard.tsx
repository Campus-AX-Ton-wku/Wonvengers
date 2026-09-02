import Link from "next/link";
import { formatDotDate } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import { benefitFormula } from "@/lib/benefit";
import { formatDeadline, type BenefitResultCardData } from "@/lib/benefit-result";
import type { ListingInput, PolicyResult } from "@/lib/types";
import {
  Check,
  ChevronRight,
  ExternalLink,
  ICON_SM,
  TriangleAlert,
} from "@/app/components/icons";
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

/** 공식 Figma Benefit Result Card(104:56)의 앱 구현. */
export default function BenefitResultCard({ card, result }: { card: BenefitResultCardData; result: PolicyResult }) {
  const state = STATE_COPY[card.state];
  const statusMeta = card.state === "urgent"
    ? card.deadlineDays === 0 ? "오늘 마감" : `D-${card.deadlineDays}`
    : card.state === "check"
      ? `조건 ${card.evidence.missingCount}개 확인`
      : `조건 ${card.evidence.matchedCount}개 일치`;
  const decisionTitle = card.state === "urgent" && card.deadlineAt
    ? `${formatDeadline(card.deadlineAt)} 마감`
    : card.state === "check"
      ? `${card.evidence.missingCount}가지 정보가 더 필요해요`
      : "내 조건과 잘 맞아요";
  const amountLabel = result.estimatedAmount > 0
    ? card.state === "check" ? "확인 후 받을 수 있는 예상 금액" : "받을 수 있는 예상 금액"
    : "공고상 받을 수 있는 금액";
  const amountText = `${card.amount.isMaximum ? "최대 " : ""}${formatKoreanMoney(card.amount.value)}`;

  return (
    <article className="rounded-card bg-surface p-4 shadow-card" aria-labelledby={`benefit-${card.policyId}`}>
      <div className="flex min-h-[30px] items-center justify-between gap-3">
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
        <p className={`text-right text-xs font-bold ${card.state === "urgent" ? "text-danger-700" : card.state === "check" ? "text-warn-800" : "text-ok-700"}`}>
          {statusMeta}
        </p>
        <span className="sr-only">{result.status}</span>
      </div>

      <div className="mt-4">
        <h3 id={`benefit-${card.policyId}`} className="line-clamp-3 text-[19px] font-extrabold leading-[1.4] text-ink-900">
          {card.title}
        </h3>
        <p className="mt-1 text-xs text-ink-500">{card.agency}</p>
      </div>

      <div className="mt-4 rounded-control bg-accent-50 px-4 py-3.5">
        <p className="text-[11px] font-bold text-ink-600">{amountLabel}</p>
        <p className="mt-1 text-[26px] font-extrabold leading-tight text-accent-700 tabular-nums" aria-label={`${amountLabel}, ${amountText}, ${card.amount.period}`}>
          {amountText}
        </p>
        <p className="mt-1 text-[11px] text-ink-600">{card.amount.period}</p>
      </div>

      <div className={`mt-3 rounded-[14px] px-3.5 py-3 ${card.state === "urgent" ? "bg-danger-50" : card.state === "check" ? "bg-warn-50" : "bg-ok-50"}`}>
        <p className={`text-sm font-bold ${card.state === "urgent" ? "text-danger-700" : card.state === "check" ? "text-warn-800" : "text-ok-700"}`}>
          {decisionTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">{card.evidence.message}</p>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {card.steps.map((step) => (
          <li key={step.label}>
            <StepRow step={step} />
          </li>
        ))}
      </ol>

      <DestinationLink href={card.primaryAction.href} className={`${buttonClass({ variant: card.primaryAction.kind === "prepare" ? "primary" : "secondary", size: "md" })} mt-3 min-h-[50px]`}>
        {card.primaryAction.label}
      </DestinationLink>

      <a
        href={card.source.url}
        target="_blank"
        rel="noreferrer"
        className="focus-ring mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-control px-2 text-center text-[11px] font-medium text-ink-600 underline"
        aria-label={`${card.source.name} 공식 출처 새 창에서 열기`}
      >
        공식 출처 · {card.source.name}
        {card.source.updatedAt ? ` · ${formatDotDate(card.source.updatedAt)} 대조` : " · 원문 확인 필요"}
        <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
      </a>

    </article>
  );
}

/** 공식 카드 밖에서 필요할 때만 펼치는 기존 계산·검수 정보. */
export function BenefitResultDetails({ result, listing }: { result: PolicyResult; listing: ListingInput }) {
  return (
    <div className="rounded-card bg-surface px-4 py-2 shadow-card">
      <Disclosure label={`요건 자세히 보기 · ${requirementCounts(result)}`}>
        <RequirementList title="충족" items={result.passedLabels} tone="text-ok-700" />
        <RequirementList title="확인 필요" items={result.unknownLabels} tone="text-warn-800" />
        <RequirementList title="미충족" items={result.failedLabels} tone="text-ink-600" />
      </Disclosure>

      <Disclosure label="예상 금액 계산식 보기">
        <p className="px-1 text-xs leading-relaxed text-ink-600">{benefitFormula(result.policy, listing)}</p>
      </Disclosure>

      <Disclosure label="검수 상태 · 참고사항">
        <p className="text-xs text-ink-600">{result.policy.effectiveYear}년 기준 · {result.policy.verifiedAt ? `${formatDotDate(result.policy.verifiedAt)} 확인` : "팀 교차검수 전 (미검증 초안)"}</p>
        {result.policy.notes && <p className="mt-1 text-xs leading-relaxed text-ink-600">{result.policy.notes}</p>}
      </Disclosure>
    </div>
  );
}

function StepRow({ step }: { step: BenefitResultCardData["steps"][number] }) {
  const warning = step.tone === "warn";
  const danger = step.tone === "danger";
  const content = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${danger ? "bg-danger-600" : warning ? "bg-warn-800" : "bg-brand-600"}`}>
        {warning || danger ? <TriangleAlert size={ICON_SM} aria-hidden="true" /> : <Check size={ICON_SM} strokeWidth={2.5} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-ink-500">{step.label}</span>
        <span className="block text-sm font-bold text-ink-900">{step.value}</span>
      </span>
      {step.href && (isExternal(step.href)
        ? <ExternalLink size={ICON_SM} aria-hidden="true" className={danger ? "text-danger-700" : warning ? "text-warn-800" : "text-brand-700"} />
        : <ChevronRight size={ICON_SM} aria-hidden="true" className={danger ? "text-danger-700" : warning ? "text-warn-800" : "text-brand-700"} />)}
    </>
  );
  const className = `focus-ring flex min-h-[58px] items-center gap-3 rounded-control px-3 py-2 text-left ${danger ? "bg-danger-50" : warning ? "bg-warn-50" : "bg-brand-50"}`;

  return step.href ? <DestinationLink href={step.href} className={className}>{content}</DestinationLink> : <div className={className}>{content}</div>;
}

function requirementCounts(result: PolicyResult): string {
  const parts = [
    result.passedLabels.length > 0 ? `충족 ${result.passedLabels.length}` : null,
    result.unknownLabels.length > 0 ? `확인 필요 ${result.unknownLabels.length}` : null,
    result.failedLabels.length > 0 ? `미충족 ${result.failedLabels.length}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "판정하지 않음";
}

function RequirementList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return <div className="mt-2"><p className={`text-sm font-bold ${tone}`}>{title}</p><ul className="mt-1 list-disc pl-4 text-sm leading-relaxed text-ink-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
