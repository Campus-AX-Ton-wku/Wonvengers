import Link from "next/link";
import { formatDotDate } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import { ageLimitReason, benefitFormula, monthlyBreakdown, supportAgeLimit } from "@/lib/benefit";
import { formatDeadline, type BenefitResultCardData } from "@/lib/benefit-result";
import type { ListingInput, PolicyResult } from "@/lib/types";
import { CircleCheck, ExternalLink, ICON_SM } from "@/app/components/icons";
import { appliedDayLabel } from "@/lib/applied";
import { Disclosure, Icon3D, SaveButton, StatusBadge, buttonClass } from "@/app/components";

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
 * 남긴 것과 순서: 상태 배지(마감 임박이면 옆에 마감일) · ♡ 찜 → 이름 · 기관 → 금액(지급 방식 한 줄)
 * → 다음 행동 하나(신청 준비) → 자세히(요건 · 계산식) → 출처 · 대조일.
 * 확인 필요도 여기서 조건을 따지게 하지 않는다(11/17) — "자격 조건은 신청 준비에서 확인해요" 한 줄만 두고,
 * 정책별 조건은 찜 → 홈 → 신청 준비 체크리스트의 '자격 조건 확인'에서 확인한다.
 * 뺀 것: 우상단 "조건 N개 일치/확인", 신청 가능 카드의 "내 조건과 잘 맞아요" 상자,
 * 자격 요건 · 지원 형태 · 신청 방식 행(배지 · 금액 · 버튼과 같은 말), '검수 상태' 토글(출처 줄의 대조일).
 *
 * 금액 색(남색 brand-900 + 연한 파랑 상자)은 맨 위 합계에 들어간 금액에만 쓴다(11/20 금색 → 남색). 합계에 없는
 * 공고 금액을 같은 상자에 두면 카드 금액을 모두 더한 만큼 받는다고 읽힌다 — 그런 금액은 잉크색으로.
 *
 * 11/18 (진단 2회차): 매달 주는 지원은 한 달 금액을 크게, 개월 합계를 아래에('254만원 · 매월 지급'이 매달 254만원으로
 * 읽혔다). 합계 밖 지원은 작은 카드 — 이름 · 공고상 금액 · 보조 버튼 · 출처만. "위 합계에 넣지 않았어요 · 자격은
 * 신청 준비에서" 같은 공통 설명은 결과 화면의 '조건이 맞으면 더 받을 수 있는 지원' 묶음이 한 번만 한다.
 */
export default function BenefitResultCard({
  card,
  result,
  listing,
  birthDate,
  appliedDay,
}: {
  card: BenefitResultCardData;
  result: PolicyResult;
  listing: ListingInput;
  /** '신청을 마쳤어요'로 표시한 날(11/23) — 있으면 이름 밑에 '신청 완료'. 계산(합계)은 그대로다 */
  appliedDay?: string;
  /** 받는 동안 나이를 따지는 지원을 나이 상한 전까지만 세려고 쓴다(11/21). 판정과 같은 값이어야 금액이 맞는다 */
  birthDate?: string;
}) {
  const state = STATE_COPY[card.state];
  const amountText = `${card.amount.isMaximum ? "최대 " : ""}${formatKoreanMoney(card.amount.value)}`;
  const amountLabel = card.state === "check" ? "확인 후 받을 수 있는 예상 금액" : "예상 금액";
  const deadlineMeta =
    card.state === "urgent" && card.deadlineAt && card.deadlineDays !== null
      ? `${formatDeadline(card.deadlineAt)} 마감 · ${card.deadlineDays === 0 ? "오늘" : `D-${card.deadlineDays}`}`
      : null;

  // 확인할 조건이 남은 지원(11/23)은 합계 밖이어도 큰 카드 — '확인 필요' 요건 목록과 예상 금액을 그대로 보여 준다
  if (!card.amount.countsInTotal && card.amount.excludedReason !== "unconfirmed") {
    return (
      <article className="rounded-card bg-surface p-4 shadow-card" aria-labelledby={`benefit-${card.policyId}`}>
        {/* 상태 배지('확인 필요' 주황)는 두지 않는다(11/20) — 묶음 제목 '조건이 맞으면 더 받을 수 있는 지원'과
            설명이 이미 자격 확인이 남았다고 말한다. 마감 임박만 이름 위에 한 줄. */}
        {deadlineMeta && <p className="text-xs font-bold text-danger-700">{deadlineMeta}</p>}
        <div className="flex items-start justify-between gap-2">
          {/* 정책 종류 그림(11/20) — 목록 · 찜 카드와 같은 자리 */}
          <div className="flex min-w-0 items-center gap-3 pt-1">
            <Icon3D name={result.policy.icon} size={40} />
            <div className="min-w-0">
              <h3 id={`benefit-${card.policyId}`} className="text-base font-extrabold leading-snug text-ink-900">
                {card.title}
              </h3>
              <p className="mt-0.5 text-xs text-ink-500">{card.agency}</p>
              {appliedDay && <AppliedTag day={appliedDay} />}
            </div>
          </div>
          <SaveButton policyId={card.policyId} policyName={card.title} className="-mr-2 -mt-1 shrink-0" />
        </div>
        <span className="sr-only">{result.status}</span>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          공고상 금액 <strong className="font-extrabold text-ink-900 tabular-nums">{amountText}</strong>
          <span className="block text-xs text-ink-500">{card.amount.period}</span>
        </p>
        {card.amount.excludedReason === "overlap" && card.amount.note && (
          <p className="mt-1 text-xs text-ink-600">{card.amount.note}</p>
        )}
        <DestinationLink
          href={card.primaryAction.href}
          className={`${buttonClass({ variant: "secondary", size: "md" })} mt-3 min-h-11`}
        >
          {card.primaryAction.label}
        </DestinationLink>
        <SourceLink card={card} />
      </article>
    );
  }

  // 매달 주는 지원은 한 달 금액을 크게 — 개월 합계는 아래 한 줄
  const perMonth = monthlyBreakdown(result.policy, listing, birthDate);
  const bigText = perMonth ? `월 ${formatKoreanMoney(perMonth.monthly)}` : amountText;
  const subText = perMonth ? `${perMonth.months}개월이면 ${formatKoreanMoney(card.amount.value)}` : card.amount.period;
  // 입력한 거주 개월보다 적게 셌으면 이유를 금액 바로 밑에 — 안 적으면 '24개월 산다고 했는데 왜 17개월?'이 된다
  const ageLimit = supportAgeLimit(result.policy, listing, birthDate);
  // 배지(확인 필요 · 마감 임박)가 있을 때만 윗줄을 둔다 — 마감일 표시는 마감 임박일 때만 있으니 배지와 같이 간다
  const hasStatusRow = card.state !== "eligible";

  return (
    <article className="rounded-card bg-surface p-4 shadow-card" aria-labelledby={`benefit-${card.policyId}`}>
      {/* 상태 문구는 화면에 배지가 없어도 스크린리더에 남긴다 */}
      <span className="sr-only">{result.status}</span>
      {/* 11/20: 합계 안 카드가 '신청 가능'이면 묶음 제목("위 금액에 넣은 지원")이 이미 말한다 — 배지는 확인 필요 · 마감 임박일 때만.
          11/22 ggue: 배지가 없는 카드에 배지 줄을 남기면 빈 칸 + ♡(44px)만 한 줄을 차지해 이름 위가 휑했다 —
          그때는 윗줄 없이 ♡ 를 이름 줄 오른쪽 위에 붙인다(합계 밖 작은 카드와 같은 자리). */}
      {hasStatusRow && (
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          <div className="flex items-center gap-1">
            {deadlineMeta && <p className="text-right text-xs font-bold text-danger-700">{deadlineMeta}</p>}
            <SaveButton policyId={card.policyId} policyName={card.title} className="-mr-2" />
          </div>
        </div>
      )}

      {/* 정책 종류 그림(11/20) — 목록 · 찜 카드와 같은 자리. 금액 칸에는 붙이지 않는다(숫자가 주인공) */}
      <div className={`flex items-start justify-between gap-2 ${hasStatusRow ? "mt-3" : ""}`}>
        <div className="flex min-w-0 items-center gap-3 pt-1">
          <Icon3D name={result.policy.icon} size={40} />
          <div className="min-w-0">
            <h3 id={`benefit-${card.policyId}`} className="line-clamp-3 text-[19px] font-extrabold leading-[1.4] text-ink-900">
              {card.title}
            </h3>
            <p className="mt-1 text-xs text-ink-500">{card.agency}</p>
            {appliedDay && <AppliedTag day={appliedDay} />}
          </div>
        </div>
        {!hasStatusRow && <SaveButton policyId={card.policyId} policyName={card.title} className="-mr-2 -mt-1 shrink-0" />}
      </div>

      <div className="mt-4 rounded-control bg-brand-50 px-4 py-3.5">
        <p className="text-xs font-bold text-ink-600">{amountLabel}</p>
        <p
          className="mt-1 text-[26px] font-extrabold leading-tight text-brand-900 tabular-nums"
          aria-label={`${amountLabel}, ${bigText}, ${subText}`}
        >
          {bigText}
        </p>
        <p className="mt-1 text-xs text-ink-600">{subText}</p>
        {ageLimit && <p className="mt-0.5 text-xs text-ink-600">{ageLimitReason(ageLimit)}만 셌어요</p>}
        {card.amount.excludedReason === "unconfirmed" && card.amount.note && (
          <p className="mt-1.5 text-xs font-semibold text-warn-800">{card.amount.note}</p>
        )}
      </div>

      <DestinationLink
        href={card.primaryAction.href}
        className={`${buttonClass({ variant: "primary", size: "md" })} mt-3 min-h-[50px]`}
      >
        {card.primaryAction.label}
      </DestinationLink>

      <Disclosure label="요건과 계산 방법 보기">
        <RequirementList title="충족" items={result.passedLabels} tone="text-ok-700" />
        <RequirementList title="확인 필요" items={result.unknownLabels} tone="text-warn-800" />
        <RequirementList title="미충족" items={result.failedLabels} tone="text-ink-600" />
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-600">{benefitFormula(result.policy, listing, birthDate)}</p>
      </Disclosure>

      <SourceLink card={card} />
    </article>
  );
}

function SourceLink({ card }: { card: BenefitResultCardData }) {
  return (
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

/** 신청 완료 표시 (11/23) — 결과 화면은 계산이라 카드를 빼지 않고 표시만 한다 */
function AppliedTag({ day }: { day: string }) {
  return (
    <p className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-full bg-ok-50 px-2.5 text-xs font-bold text-ok-700">
      <CircleCheck size={ICON_SM - 2} strokeWidth={2.5} aria-hidden="true" />
      신청 완료 · {appliedDayLabel(day)}
    </p>
  );
}
