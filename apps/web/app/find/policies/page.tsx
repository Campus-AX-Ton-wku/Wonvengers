"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import FindTopBar from "@/app/find/FindTopBar";
import PolicyCard from "@/app/find/PolicyCard";
import { ChevronRightIcon } from "@/app/icons";
import { resolveAnswers } from "@/lib/age";
import { answerLine, candidateCount, groupPolicies, splitByApplicationWindow } from "@/lib/discovery";
import { todayISO } from "@/lib/date";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, HousingType, PolicyMeta } from "@/lib/types";

/**
 * 1층 · 발견 — 질문 결과 목록.
 *
 * 답변은 localStorage 에만 있다(PRD F0-13). 읽기 전에 카드를 그리면 한 프레임 동안
 * 전부 '확인 필요'로 깜빡이므로, 불러오기 전에는 자리만 잡아 둔다.
 *
 * 답이 전부 '모름'이어도 목록은 보여준다 — 저장된 답변이 없는 상태와 구분할 수
 * 없고, 모름이어도 목록이 떠야 한다(QA체크리스트 1층).
 *
 * 화면에는 지금 신청할 수 있는 것만 둔다. 마감된 사업과 대상이 아닌 사업은 접어
 * 둔다 — 지우지는 않는다. 마감 건은 다음 회차에 다시 열리고, 대상이 아닌 건은
 * 왜 아닌지가 답을 고칠 단서라서, 없애면 "그런 지원금이 아예 없다"로 읽힌다.
 */

const policies = policiesJson as PolicyMeta[];

/**
 * 2층으로 보내는 CTA 문구. 사용자가 사는 계약을 그대로 부른다.
 *
 * 연세를 '월세'로 묶어 부르면, 이 앱이 유일하게 제대로 다루는 계약을 다른 앱처럼
 * 뭉뚱그리는 셈이다 (lib/rent.ts 의 월 환산). 주거 형태를 답하지 않았거나 '그 외'인
 * 사람에게는 둘 중 하나로 단정하지 않고 '주거비'라고 부른다.
 */
function ctaLabel(housingType: HousingType | null): string {
  if (housingType === "월세") return "지원받으면\n내 월세는 얼마일까?";
  if (housingType === "연세") return "지원받으면\n내 연세 부담은 얼마나 줄까?";
  return "지원받으면\n내 주거비는 얼마일까?";
}

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

  // 접수가 끝난 정책도 1층 태그로는 '가능성 있음' 이 된다. 한 목록에 섞으면 제목의
  // 건수가 못 받는 것까지 세고, 금액이 가장 큰 마감 건이 첫 카드를 차지한다.
  const { 신청가능, 마감 } = asOf
    ? splitByApplicationWindow(groups, asOf)
    : { 신청가능: [], 마감: [] };
  // 지금 신청할 수 없는 것은 한 묶음이다. 마감이든 대상이 아니든 사용자가 지금
  // 할 일이 없다는 점은 같아서, 두 묶음으로 나누면 접힌 줄만 둘이 된다.
  const 신청불가 = [...마감, ...groups.해당없음];

  return (
    <main className="step-in mx-auto min-h-dvh max-w-lg bg-sand-100 px-5 pb-10">
      <FindTopBar backHref="/find/result" backLabel="결과 요약으로 돌아가기" />

      {!loaded || !asOf ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <>
          {/* 금액은 앞 화면(/find/result)이 크게 말했다. 여기서 또 보여주면 같은
              숫자를 두 번 붙는 셈이라 제목만 둔다.

              후보는 있는데 전부 마감이면 '해당되는 것이 없어요' 로 말하면 안 된다.
              대상이 아니라는 뜻으로 읽히지만 실제로는 다음 회차를 기다리면 된다. */}
          <h1 className="mt-6 text-2xl font-extrabold leading-snug text-ink-900">
            {신청가능.length > 0
              ? `받을 수 있는 주거 혜택 ${신청가능.length}개`
              : count > 0
                ? "지금 받을 수 있는 주거 혜택이 없어요"
                : "아쉽게도 해당되는 주거 혜택이 없어요"}
          </h1>

          {/* 무슨 답변으로 나온 결과인지 한 줄로 말하고, 바로 고치러 갈 수 있게 한다.
              소득 구간은 여기 두지 않는다 — 조건 수정 화면에 그대로 있다. */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-ink-500">{answerLine(resolved)}</p>
            <Link
              href="/find"
              className="flex shrink-0 items-center gap-0.5 rounded-lg py-1 pl-2 text-sm font-semibold text-ink-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              조건 수정
              <ChevronRightIcon size={16} className="text-ink-200" />
            </Link>
          </div>

          {/* 카드 사이는 여백으로 가른다. 구분선을 함께 쓰면 목록이 표처럼 읽힌다. */}
          <section
            aria-label={`받을 수 있는 주거 혜택 ${신청가능.length}개`}
            className="mt-6 space-y-3"
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

          {count === 0 && (
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              지금 답변으로는 조건에 맞는 지원금을 찾지 못했습니다. 아래에서 이유를 확인하고,{" "}
              <Link href="/find" className="font-bold text-brand-700 underline">
                답변을 바꿔
              </Link>{" "}
              다시 확인해 보세요.
            </p>
          )}

          {/* 지금 신청할 수 없는 것은 접어 둔다. 마감된 480만원짜리 카드가 펼쳐져
              있으면 실제로 받을 수 있는 50만원보다 크게 읽힌다. */}
          {신청불가.length > 0 && (
            <details className="group mt-6" open={신청가능.length === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-4 text-sm font-bold text-ink-600 transition-colors hover:bg-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&::-webkit-details-marker]:hidden">
                <span>신청할 수 없는 지원금 {신청불가.length}개</span>
                <ChevronRightIcon
                  size={18}
                  className="shrink-0 text-ink-200 transition-transform group-open:rotate-90"
                />
              </summary>
              <div className="mt-2 space-y-3">
                {신청불가.map(({ policy, result }) => (
                  <PolicyCard key={policy.id} policy={policy} result={result} asOfISO={asOf} />
                ))}
              </div>
            </details>
          )}

          {/* 다음에 할 일 하나. 목록이 답한 것은 '얼마까지'이고, 사용자가 실제로
              궁금한 것은 '그래서 내 주거비가 얼마가 되나'다.

              전세 거주자에게는 이 CTA 를 내보내지 않는다. 계약 조건 화면(2층)이
              받는 계약 형태가 월세·연세뿐이라, 전세 부담이 얼마나 주는지 계산할
              방법이 없다. 문구만 전세용으로 바꾸면 눌러서 막히는 길이 된다. */}
          {count > 0 &&
            (resolved.housingType === "전세" ? (
              <p className="mt-8 rounded-2xl bg-sand-50 px-5 py-4 text-sm leading-relaxed text-ink-600">
                전세 부담이 얼마나 줄어드는지는 아직 계산해드리지 못합니다. 지금은 월세·연세 계약만
                계산할 수 있어요.
              </p>
            ) : (
              <Link
                href="/calculate"
                className="mt-8 flex items-center justify-between gap-3 rounded-2xl bg-brand-600 px-5 py-5 transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:bg-brand-700"
              >
                <span className="whitespace-pre-line text-left text-lg font-bold leading-snug text-white">
                  {ctaLabel(resolved.housingType)}
                </span>
                <ChevronRightIcon size={22} className="shrink-0 text-white/80" />
              </Link>
            ))}

          <p className="mt-8 text-sm leading-relaxed text-ink-500">
            이 화면은 나이 · 지역 · 현재 상태 · 소득 구간 · 주거 형태만 비교한 결과이며,
            <strong> 신청 자격을 확정하는 것이 아닙니다.</strong> 무주택 여부, 가구 소득, 복지 자격
            등 남은 조건과 최종 지원 여부는 각 기관이 심사해 결정합니다. 반드시 공식 페이지에서
            확인하세요.
          </p>
        </>
      )}
    </main>
  );
}
