"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import {
  AppShell,
  CARD_STATUS_BADGE,
  Disclosure,
  LinkButton,
  StatusBadge,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { ICON_SM, ShieldCheck, TriangleAlert } from "@/app/components/icons";
import { resolveAnswers } from "@/lib/age";
import { benefitCeiling } from "@/lib/benefit";
import { cardStatus } from "@/lib/discovery";
import { formatDotDate, todayISO } from "@/lib/date";
import { tagPolicy } from "@/lib/filter";
import { getRequiredQuestions } from "@/lib/questions";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, IncomeBracket, PolicyMeta } from "@/lib/types";

/**
 * 정책 하나의 전부.
 *
 * 판정은 목록과 같은 함수(tagPolicy · cardStatus)로 한다. 화면마다 따로 판정하면
 * 목록의 배지와 상세의 배지가 어긋난다.
 */

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as PolicyMeta[];

const bracketLabel = (bracket: number | null) =>
  brackets.find((b) => b.bracket === bracket)?.label ?? null;

/**
 * 1층 질문 네 개로 판정하는 조건. 값을 지어내지 않는다 — 공고를 확인하지 못해
 * null 로 남은 항목은 '공고에서 확인 전' 이라고 그대로 적는다 (PRD F0-5).
 */
function targetRows(policy: PolicyMeta): { label: string; value: string }[] {
  const { ageMin, ageMax, statuses, incomeBracketMin: min, incomeBracketMax: max } = policy.discovery;
  const 소득 =
    max === null
      ? "1층 질문(본인 월 소득)으로는 판정하지 않습니다"
      : min === null
        ? `${bracketLabel(max) ?? `${max}구간`} 까지`
        : `${bracketLabel(min) ?? `${min}구간`} ~ ${bracketLabel(max) ?? `${max}구간`}`;

  // 둘 다 null 이면 나이를 요건으로 두지 않는 사업이다. '만 null~null세'로 찍히면
  // 안 되고, 없는 제한을 지어내서도 안 된다 (types.ts 의 PolicyDiscovery 주석).
  const 나이 =
    ageMin === null && ageMax === null
      ? "나이 제한 없음"
      : ageMin === null
        ? `만 ${ageMax}세 이하`
        : ageMax === null
          ? `만 ${ageMin}세 이상`
          : `만 ${ageMin}~${ageMax}세`;

  return [
    { label: "나이", value: 나이 },
    { label: "지역", value: policy.regionScope },
    { label: "현재 상태", value: statuses ? statuses.join(" · ") : "공고에서 확인 전" },
    { label: "소득 구간", value: 소득 },
    {
      label: "주거 형태",
      value: policy.discovery.housingTypes
        ? policy.discovery.housingTypes.join(" · ")
        : "따지지 않음",
    },
  ];
}

export default function PolicyDetail({ id }: { id: string }) {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAnswers(loadAnswers());
    setAsOf(todayISO());
  }, []);

  const policy = policies.find((p) => p.id === id);

  if (!policy) {
    return (
      <AppShell>
        <TopBar backHref="/find/policies" backLabel="목록으로 돌아가기" />
        <p className="mt-10 text-center text-sm text-ink-500">찾을 수 없는 지원금입니다.</p>
      </AppShell>
    );
  }

  const resolved = resolveAnswers(answers, asOf ?? null);
  const result = tagPolicy(policy, resolved);
  const status = asOf ? cardStatus(policy, result, asOf) : null;
  const ceiling = benefitCeiling(policy);
  const applicationPeriod = `${formatDotDate(policy.applicationStart)} ~ ${
    policy.applicationEnd ? formatDotDate(policy.applicationEnd) : "상시"
  }`;
  // 정책이 요구하는 입력 항목의 사람이 읽는 라벨. 2층 질문과 같은 출처를 쓴다.
  const 남은조건 = getRequiredQuestions([policy])
    .filter((q) => q.key !== "birthDate")
    .map((q) => q.label);

  return (
    <AppShell className="step-in">
      <TopBar backHref="/find/policies" backLabel="목록으로 돌아가기" />
      <main className="flex flex-col gap-3 pb-6 pt-1">
        <header>
          <p className="text-[11px] font-bold leading-4 text-ink-500">혜택 상세</p>
          <div className="mt-0.5 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold leading-[34px] text-ink-900">{policy.name}</h1>
            <div className="flex min-h-6 shrink-0 items-center pt-1">
              {status && (
                <StatusBadge tone={CARD_STATUS_BADGE[status].tone} icon={CARD_STATUS_BADGE[status].icon}>
                  {status}
                </StatusBadge>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs leading-[18px] text-ink-500">
            운영 기관 · <span>{policy.agency}</span>
          </p>
        </header>

        <section className="mt-2 rounded-control bg-accent-50 p-4" aria-label="지원 요약">
          <p className="text-xs font-medium leading-[18px] text-ink-500">예상 지원 또는 절약</p>
          <p className="mt-1 text-[32px] font-black leading-10 text-ok-700">
            {ceiling?.label ?? "공고 기준으로 확인"}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-ink-600">{policy.benefitSummary}</p>
          {ceiling && (
            <p className="mt-1 text-[11px] leading-4 text-ink-500">
              공고 기준 상한이며 실제 지원액은 심사에 따라 달라집니다.
            </p>
          )}
        </section>

        <section
          className={`rounded-control px-4 py-3.5 ${
            result.tag === "가능성 있음"
              ? "bg-ok-50"
              : result.tag === "확인 필요"
                ? "bg-warn-50"
                : "bg-ink-100"
          }`}
          aria-labelledby="recommendation-title"
        >
          <h2
            id="recommendation-title"
            className={`text-sm font-bold leading-[22px] ${
              result.tag === "가능성 있음"
                ? "text-ok-700"
                : result.tag === "확인 필요"
                  ? "text-warn-800"
                  : "text-ink-900"
            }`}
          >
            {result.tag === "해당 없음" ? "대상이 아닌 이유" : "왜 추천됐나요?"}
          </h2>
          {result.tag === "가능성 있음" && (
            <p className="mt-1 text-[11px] leading-4 text-ink-500">
              입력한 기본 조건이 공고의 지원 대상과 일치해요.
            </p>
          )}
          {result.tag === "확인 필요" && (
            <p className="mt-1 text-[11px] leading-4 text-ink-600">
              {result.unknownFields.join(" · ")} 정보를 확인하면 더 정확히 안내할 수 있어요.
            </p>
          )}
          {result.tag === "해당 없음" && (
            <ul className="mt-1 list-disc pl-4 text-[11px] leading-4 text-ink-600">
              {result.failReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          )}
        </section>

        <section className="rounded-control bg-surface px-4 py-3.5 shadow-card" aria-labelledby="before-apply-title">
          <h2 id="before-apply-title" className="text-sm font-bold leading-[22px] text-ink-900">
            신청 전 확인
          </h2>
          <dl className="mt-2 flex flex-col gap-2.5">
            <DetailRow label="자격 조건" value={result.tag === "확인 필요" ? "추가 확인 필요" : "내 정보와 대조"} />
            <DetailRow label="모집 기간" value={applicationPeriod} />
            <DetailRow label="준비 서류" value="공식 공고 기준" />
            <DetailRow label="신청 방법" value="공식 사이트" />
          </dl>
        </section>

        {status === "접수 마감" && policy.applicationEnd && (
          <p className="rounded-control bg-ink-100 p-4 text-sm leading-[22px] text-ink-600">
            <strong className="text-ink-900">{formatDotDate(policy.applicationEnd)}에 접수가 끝났습니다.</strong>{" "}
            다음 모집 공고를 기다려야 합니다.
          </p>
        )}

        {status === "신청 예정" && (
          <p className="rounded-control bg-brand-50 p-4 text-sm leading-[22px] text-ink-600">
            <strong className="text-ink-900">{formatDotDate(policy.applicationStart)}부터 접수합니다.</strong>
          </p>
        )}

        {result.tag === "확인 필요" && (
          <div className="rounded-control bg-warn-50 p-4">
            <p className="flex items-start gap-2 text-sm font-bold leading-[22px] text-warn-800">
              <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{result.unknownFields.join(" · ")}을(를) 답하지 않아 판단을 보류했습니다.</span>
            </p>
            <Link
              href="/find"
              className="focus-ring mt-1 inline-flex min-h-11 items-center rounded-control text-sm font-bold text-brand-700 underline hover:text-brand-800"
            >
              조건 수정하기
            </Link>
          </div>
        )}

        <Disclosure label="지원 대상 자세히 보기">
          <section aria-label="지원 대상" className="px-1 pb-1">
            <dl className="space-y-2">
              {targetRows(policy).map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          </section>
        </Disclosure>

        {남은조건.length > 0 && (
          <Disclosure label={`기관 심사에서 확인할 조건 ${남은조건.length}개`}>
            <p className="px-1 text-xs leading-relaxed text-ink-500">
              아래 항목은 입력값만으로 확정하지 않으며 신청 기관이 심사합니다.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-ink-600">
              {남은조건.map((condition) => <li key={condition}>{condition}</li>)}
            </ul>
          </Disclosure>
        )}

        <SourceNotice sourceUrl={policy.sourceUrl} verifiedAt={policy.verifiedAt} />
      </main>

      <StickyBottomAction>
        {status === "신청 가능" ? (
          <LinkButton href={`/find/policies/${policy.id}/prepare`} size="screen">신청 준비하기</LinkButton>
        ) : status === "확인 필요" ? (
          <LinkButton href="/find" size="screen">조건 확인하기</LinkButton>
        ) : (
          <LinkButton href="/find/policies" size="screen" variant="secondary">다른 혜택 보기</LinkButton>
        )}
      </StickyBottomAction>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-4 text-sm">
      <dt className="shrink-0 text-[11px] leading-4 text-ink-500">{label}</dt>
      <dd className="text-right text-xs font-medium leading-[18px] text-ink-900">{value}</dd>
    </div>
  );
}

/**
 * 이 숫자들이 어느 공고에서 온 값인지, 언제 대조한 것인지.
 *
 * 앱 데이터는 팀이 공고를 손으로 옮긴 값이라 원문으로 가는 길이 있어야 한다.
 * 정책이 아니라 두 값만 받는다 — 검수 전 분기(verifiedAt: null)를 확인하려면
 * 테스트가 그 상태를 직접 만들 수 있어야 하는데, policies.json 의 다섯 정책은
 * 지금 전부 검수를 마쳤다 (app/__tests__/policy-verification-notice.test.tsx).
 */
export function SourceNotice({
  sourceUrl,
  verifiedAt,
}: {
  sourceUrl: string;
  verifiedAt: string | null;
}) {
  return (
    <section aria-label="이 정보의 출처" className="mt-8 border-t border-ink-200 pt-5">
      <h2 className="text-sm font-bold text-ink-900">이 정보의 출처</h2>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-bold text-brand-700 underline hover:text-brand-800"
      >
        공고 원문 →
      </a>
      {verifiedAt ? (
        <p className="flex items-start gap-1.5 text-xs text-ink-500">
          <ShieldCheck size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>팀이 {verifiedAt}에 공고 원문과 대조했습니다.</span>
        </p>
      ) : (
        <p className="flex items-start gap-1.5 text-xs font-bold text-warn-800">
          <TriangleAlert size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>아직 공고 원문과 대조하지 않았습니다. 신청 전에 원문을 직접 확인하세요.</span>
        </p>
      )}
    </section>
  );
}
