"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import FindTopBar from "@/app/find/FindTopBar";
import { resolveAnswers } from "@/lib/age";
import { benefitCeiling } from "@/lib/benefit";
import { cardStatus } from "@/lib/discovery";
import { formatDotDate, todayISO } from "@/lib/date";
import { tagPolicy } from "@/lib/filter";
import { getRequiredQuestions } from "@/lib/questions";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type {
  DiscoveryAnswers,
  DiscoveryCardStatus,
  IncomeBracket,
  PolicyMeta,
} from "@/lib/types";

/**
 * 정책 하나의 전부.
 *
 * 판정은 목록과 같은 함수(tagPolicy · cardStatus)로 한다. 화면마다 따로 판정하면
 * 목록의 배지와 상세의 배지가 어긋난다.
 */

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as PolicyMeta[];

const STATUS_STYLE: Record<DiscoveryCardStatus, string> = {
  "신청 가능": "bg-ok-50 text-ok-700",
  "확인 필요": "bg-warn-50 text-warn-800",
  "신청 예정": "bg-brand-50 text-brand-800",
  "접수 마감": "bg-ink-100 text-ink-600",
  "대상 아님": "bg-ink-100 text-ink-600",
};

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
    {
      label: "신청 기간",
      value: `${formatDotDate(policy.applicationStart)} ~ ${
        policy.applicationEnd ? formatDotDate(policy.applicationEnd) : "상시"
      }`,
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
      <main className="mx-auto max-w-lg px-5 pb-10">
        <FindTopBar backHref="/find/policies" backLabel="목록으로 돌아가기" />
        <p className="mt-10 text-center text-sm text-ink-500">찾을 수 없는 지원금입니다.</p>
      </main>
    );
  }

  const resolved = resolveAnswers(answers, asOf ?? null);
  const result = tagPolicy(policy, resolved);
  const status = asOf ? cardStatus(policy, result, asOf) : null;
  const ceiling = benefitCeiling(policy);
  // 정책이 요구하는 입력 항목의 사람이 읽는 라벨. 2층 질문과 같은 출처를 쓴다.
  const 남은조건 = getRequiredQuestions([policy])
    .filter((q) => q.key !== "birthDate")
    .map((q) => q.label);

  return (
    <main className="step-in mx-auto max-w-lg px-5 pb-10">
      <FindTopBar backHref="/find/policies" backLabel="목록으로 돌아가기" />

      {/* 상태 배지는 기준일이 있어야 정해진다. 없는 동안 자리만 비워 두면 값이
          들어올 때 아래 내용이 밀리지 않는다. */}
      <div className="mt-6 flex h-6 items-center">
        {status && (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}
          >
            {status}
          </span>
        )}
      </div>

      <h1 className="mt-2 break-keep text-2xl font-extrabold leading-snug text-ink-900">
        {policy.name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{policy.agency}</p>

      {ceiling && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-ink-500">공고 상한</p>
          <p className="text-[34px] font-extrabold leading-none text-accent-600">{ceiling.label}</p>
          <p className="mt-2 break-keep text-sm leading-relaxed text-ink-600">
            {policy.benefitSummary}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            공고 기준 상한이며, 실제 지원액은 심사에 따라 달라집니다.
          </p>
        </div>
      )}

      {/* 왜 이 상태인지. 배지만 보고는 알 수 없다 (PRD F0-5). */}
      {result.tag === "해당 없음" && (
        <div className="mt-6 rounded-xl bg-ink-100 p-4">
          <p className="text-sm font-bold text-ink-900">대상이 아닌 이유</p>
          <ul className="mt-1 list-disc pl-4 text-sm leading-relaxed text-ink-600">
            {result.failReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {result.tag === "확인 필요" && (
        <div className="mt-6 rounded-xl bg-warn-50 p-4">
          <p className="text-sm font-bold text-warn-800">
            {result.unknownFields.join(" · ")}을(를) 답하지 않아 판단을 보류했습니다.
          </p>
          <Link
            href="/find"
            className="mt-1 inline-block text-sm font-bold text-brand-700 underline hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            조건 수정하기
          </Link>
        </div>
      )}

      {status === "접수 마감" && policy.applicationEnd && (
        <p className="mt-6 text-sm leading-relaxed text-ink-600">
          <strong className="text-ink-900">
            {formatDotDate(policy.applicationEnd)}에 접수가 끝났습니다.
          </strong>{" "}
          다음 모집 공고를 기다려야 합니다.
        </p>
      )}

      {status === "신청 예정" && (
        <p className="mt-6 text-sm leading-relaxed text-ink-600">
          <strong className="text-ink-900">
            {formatDotDate(policy.applicationStart)}부터 접수합니다.
          </strong>
        </p>
      )}

      <section aria-label="지원 대상" className="mt-8">
        <h2 className="text-sm font-bold text-ink-900">지원 대상</h2>
        <dl className="mt-2 space-y-2">
          {targetRows(policy).map((row) => (
            <div key={row.label} className="flex justify-between gap-4 text-sm">
              <dt className="shrink-0 text-ink-500">{row.label}</dt>
              <dd className="break-keep text-right font-semibold text-ink-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {남은조건.length > 0 && (
        <section aria-label="추가로 확인할 것" className="mt-8">
          <h2 className="text-sm font-bold text-ink-900">신청 전 확인할 것</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            이 화면의 판정은 나이 · 지역 · 상태 · 소득만 본 결과입니다. 아래 항목은 각 기관이
            심사합니다.
          </p>
          <ul className="mt-2 list-disc pl-4 text-sm leading-relaxed text-ink-600">
            {남은조건.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      <SourceNotice sourceUrl={policy.sourceUrl} verifiedAt={policy.verifiedAt} />

      <a
        href={policy.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 block rounded-2xl bg-ink-900 py-4 text-center text-base font-bold text-white transition-colors hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        공식 신청 페이지로 이동
      </a>
    </main>
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
        className="mt-1 inline-block text-sm font-semibold text-brand-700 underline hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        공고 원문 →
      </a>
      {verifiedAt ? (
        <p className="mt-1 text-xs text-ink-500">팀이 {verifiedAt}에 공고 원문과 대조했습니다.</p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-warn-800">
          아직 공고 원문과 대조하지 않았습니다. 신청 전에 원문을 직접 확인하세요.
        </p>
      )}
    </section>
  );
}
