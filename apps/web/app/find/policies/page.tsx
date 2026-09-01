"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import PolicyCard from "@/app/find/PolicyCard";
import { AppShell, EmptyState, LinkButton, TopBar } from "@/app/components";
import { ArrowUpRight, ChevronDown, ICON_MD, ICON_SM, Info, Pencil } from "@/app/components/icons";
import { resolveAnswers } from "@/lib/age";
import {
  answerSummary,
  candidateCount,
  groupPolicies,
  splitByApplicationWindow,
} from "@/lib/discovery";
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
 *
 * 카드는 흰 면이고 지면은 옅은 파랑이라 카드끼리 저절로 나뉜다. 예전에는 둘 다
 * 흰색이라 hairline 을 그어야 했다.
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

  // 1층과 같은 경계 변환. 생년월일 → 만 나이는 여기서 한 번만 한다 (lib/age.ts).
  const resolved = resolveAnswers(answers, asOf ?? null);

  const groups = groupPolicies(policies, resolved);
  const count = candidateCount(groups);
  const summary = answerSummary(resolved, brackets);

  // 접수가 끝난 정책도 1층 태그로는 '가능성 있음' 이 된다. 한 목록에 섞으면 제목의
  // 건수가 못 받는 것까지 세고, 금액이 가장 큰 마감 건이 첫 카드를 차지한다.
  // 지우지는 않는다 — 다음 회차에 다시 열리는 사업이다 (lib/discovery.ts 주석 참고).
  const { 신청가능, 마감 } = asOf
    ? splitByApplicationWindow(groups, asOf)
    : { 신청가능: [], 마감: [] };

  return (
    <AppShell>
      <TopBar backHref="/find/result" backLabel="결과 요약으로 돌아가기" />

      {!loaded ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <main className="step-in flex flex-col gap-4 pb-10 pt-2">
          {/* 금액은 앞 화면(/find/result)이 크게 말했다. 여기서 또 보여주면 같은
              숫자를 두 번 붙는 셈이라 제목만 둔다.

              후보는 있는데 전부 마감이면 '해당되는 지원금이 없어요' 로 말하면 안 된다.
              대상이 아니라는 뜻으로 읽히지만 실제로는 다음 회차를 기다리면 된다. */}
          <h1 className="mt-2 text-2xl font-extrabold leading-snug text-ink-900">
            {신청가능.length > 0
              ? `지금 신청할 수 있는 지원금 ${신청가능.length}건`
              : count > 0
                ? "지금 신청할 수 있는 지원금이 없어요"
                : "해당되는 지원금이 없어요"}
          </h1>

          {/* 무슨 답변으로 나온 결과인지 보여주고, 바로 고치러 갈 수 있게 한다. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 목록 시맨틱 — 스크린 리더가 "답변 요약, 항목 4개"로 읽는다. */}
            <ul aria-label="답변 요약" className="flex flex-wrap items-center gap-1.5">
              {summary.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-inset ring-ink-200"
                >
                  {chip}
                </li>
              ))}
            </ul>
            <Link
              href="/find"
              className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50"
            >
              <Pencil size={ICON_SM - 2} aria-hidden="true" />
              답변 고치기
            </Link>
          </div>

          {신청가능.length > 0 && (
            <section
              aria-label={`지금 신청할 수 있는 지원금 ${신청가능.length}건`}
              className="flex flex-col gap-3"
            >
              {신청가능.map(({ policy, result }, i) => (
                <div
                  key={policy.id}
                  className="stagger-in"
                  /* 지연 상한 225ms — 카드가 5장이어도 마지막 장을 기다리지 않는다. */
                  style={{ animationDelay: `${Math.min(i * 45, 225)}ms` }}
                >
                  <PolicyCard policy={policy} result={result} asOfISO={asOf} />
                </div>
              ))}
            </section>
          )}

          {count === 0 && (
            <EmptyState
              character="empty"
              title="조건에 맞는 지원금을 찾지 못했어요"
              description={
                <>
                  아래에서 정책별로 왜 해당되지 않는지 볼 수 있습니다. 답변을 바꾸면
                  결과도 달라집니다.
                </>
              }
              action={
                <LinkButton href="/find" variant="secondary">
                  답변 바꿔서 다시 찾기
                </LinkButton>
              }
            />
          )}

          {/* 마감 건은 접지 않는다. 다음 회차를 기다리면 받을 수 있다는 것 자체가
              사용자에게 필요한 정보라, 숫자와 순서에서만 갈라 두면 충분하다. */}
          {마감.length > 0 && (
            <section
              aria-label={`이번 회차는 마감된 지원금 ${마감.length}건`}
              className="mt-6 flex flex-col gap-3"
            >
              <h2 className="border-t border-ink-200 pt-5 text-sm font-bold text-ink-500">
                이번 회차는 마감된 지원금 {마감.length}건
              </h2>
              {마감.map(({ policy, result }) => (
                <PolicyCard key={policy.id} policy={policy} result={result} asOfISO={asOf} />
              ))}
            </section>
          )}

          {groups.해당없음.length > 0 && (
            <details className="group mt-4" open={count === 0}>
              <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between rounded-control px-1 text-sm font-bold text-ink-500 transition-colors hover:text-ink-700 [&::-webkit-details-marker]:hidden">
                <span>해당되지 않는 지원금 {groups.해당없음.length}건 보기</span>
                <ChevronDown
                  size={ICON_SM}
                  aria-hidden="true"
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              {/* 해당 없는 것들은 그림자 없는 카드로 내린다. 받을 수 있는 카드와
                  같은 무게로 떠 있으면 목록의 절반이 낭비된다. */}
              <div className="mt-3 flex flex-col gap-2">
                {groups.해당없음.map(({ policy, result }) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    result={result}
                    asOfISO={asOf}
                    tone="flat"
                  />
                ))}
              </div>
            </details>
          )}

          {count > 0 && (
            /* 2층으로 넘어가는 유일한 문. 목록 안의 카드와 같은 파랑을 쓰면 카드
               하나로 읽히므로, 여기만 면을 파랑으로 채운다. */
            <Link
              href="/calculate"
              className="focus-ring mt-4 block rounded-card bg-brand-600 p-5 text-left shadow-card transition-colors hover:bg-brand-700 active:bg-brand-800"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-base font-bold text-white">
                  이 지원금을 받으면 얼마를 내게 될까?
                </span>
                <ArrowUpRight
                  size={ICON_MD}
                  aria-hidden="true"
                  className="shrink-0 text-white/80"
                />
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-white/85">
                계약 조건을 넣으면 지원금을 반영한 최종 예상 주거비를 계산해드려요
              </span>
            </Link>
          )}

          {/* 고지는 본문과 같은 무게로 두지 않는다. 회색 면에 작은 글씨,
              아이콘 하나. 그러나 접지는 않는다 — 접을 수 있는 고지는 고지가 아니다. */}
          <div className="mt-4 flex gap-2.5 rounded-card bg-ink-100 p-4">
            <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
            <p className="text-xs leading-relaxed text-ink-600">
              이 화면은 나이 · 지역 · 현재 상태 · 소득 구간만 비교한 결과이며,
              <strong className="font-bold text-ink-900">
                {" "}
                신청 자격을 확정하는 것이 아닙니다.
              </strong>{" "}
              무주택 여부, 가구 소득, 복지 자격 등 남은 조건과 최종 지원 여부는 각
              기관이 심사해 결정합니다. 반드시 공식 페이지에서 확인하세요.
            </p>
          </div>
        </main>
      )}
    </AppShell>
  );
}
