"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import FindTopBar from "@/app/find/FindTopBar";
import PolicyCard from "@/app/find/PolicyCard";
import { answerSummary, candidateCount, groupPolicies } from "@/lib/discovery";
import { todayISO } from "@/lib/date";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, IncomeBracket, PolicyMeta } from "@/lib/types";

/**
 * 1층 · 발견 — 질문 결과 목록.
 *
 * 답변은 localStorage 에만 있다(PRD F0-13). 읽기 전에 카드를 그리면 한 프레임 동안
 * 전부 '확인 필요'로 깜빡이므로, 불러오기 전에는 자리만 잡아 둔다.
 *
 * 답이 전부 '모름'이어도 목록은 보여준다 — 저장된 답변이 없는 상태와 구분할 수
 * 없고, 모름이어도 목록이 떠야 한다(QA체크리스트 1층).
 */

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as PolicyMeta[];

export default function FindPoliciesPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [loaded, setLoaded] = useState(false);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAnswers(loadAnswers());
    setAsOf(todayISO());
    setLoaded(true);
  }, []);

  const groups = groupPolicies(policies, answers);
  const count = candidateCount(groups);
  const summary = answerSummary(answers, brackets);

  return (
    <main className="mx-auto max-w-lg px-5 pb-10">
      <FindTopBar backHref="/find" backLabel="질문으로 돌아가기" />

      {!loaded ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-extrabold text-ink-900">
            {count > 0 ? `지원금 ${count}건` : "해당되는 지원금이 없어요"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            나이 · 지역 · 상태 · 소득 구간만 비교한 결과입니다. 각 정책의 나머지
            조건은 카드의 &lsquo;추가로 확인할 것&rsquo;을 보세요.
          </p>

          {/* 무슨 답변으로 나온 결과인지 보여주고, 바로 고치러 갈 수 있게 한다. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {summary.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-ink-200 bg-sand-50 px-3 py-1 text-xs font-semibold text-ink-600"
              >
                {chip}
              </span>
            ))}
            <Link
              href="/find"
              className="rounded-full px-2 py-1 text-xs font-bold text-brand-700 underline transition-colors hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              답변 고치기
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {[...groups.가능, ...groups.확인].map(({ policy, result }) => (
              <PolicyCard key={policy.id} policy={policy} result={result} asOfISO={asOf} />
            ))}
          </div>

          {count === 0 && (
            <p className="mt-4 rounded-xl border border-ink-200 bg-white p-5 text-sm leading-relaxed text-ink-600">
              입력한 조건에 해당하는 지원금을 찾지 못했습니다. 아래에서 이유를
              확인하고, <Link href="/find" className="font-bold text-brand-700 underline">답변을 바꿔</Link>{" "}
              다시 확인해 보세요.
            </p>
          )}

          {groups.해당없음.length > 0 && (
            <details className="mt-6" open={count === 0}>
              <summary className="cursor-pointer text-sm font-bold text-ink-500">
                해당되지 않는 지원금 {groups.해당없음.length}건 보기
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {groups.해당없음.map(({ policy, result }) => (
                  <PolicyCard key={policy.id} policy={policy} result={result} asOfISO={asOf} />
                ))}
              </div>
            </details>
          )}

          {count > 0 && (
            <Link
              href="/calculate"
              className="mt-6 block rounded-xl bg-brand-600 p-5 text-center transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:bg-brand-700"
            >
              <span className="block text-base font-bold text-white">
                이 지원금을 받으면 얼마를 내게 될까?
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-white/90">
                계약 조건을 넣으면 지원금을 반영한 최종 예상 주거비를 계산해드려요
              </span>
            </Link>
          )}

          <p className="mt-8 rounded-xl bg-ink-100 p-4 text-xs leading-relaxed text-ink-600">
            이 화면은 나이 · 지역 · 현재 상태 · 소득 구간만 비교한 결과이며,
            <strong> 신청 자격을 확정하는 것이 아닙니다.</strong> 무주택 여부,
            가구 소득, 복지 자격 등 남은 조건과 최종 지원 여부는 각 기관이 심사해
            결정합니다. 반드시 공식 페이지에서 확인하세요.
          </p>
        </>
      )}
    </main>
  );
}
