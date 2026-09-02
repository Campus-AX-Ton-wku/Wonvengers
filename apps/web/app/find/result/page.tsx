"use client";

import { useEffect, useState } from "react";
import policiesJson from "@/data/policies.json";
import {
  AppShell,
  LinkButton,
  PerkyCharacter,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { resolveAnswers } from "@/lib/age";
import { largestTotalCeiling } from "@/lib/benefit";
import { candidateCount, groupPolicies, splitByApplicationWindow } from "@/lib/discovery";
import { todayISO } from "@/lib/date";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, PolicyMeta } from "@/lib/types";

/**
 * 1층 · 발견 — 결과 요약.
 *
 * 질문 네 개에 답한 보상을 주는 화면이다. 예전에는 이 숫자가 목록 맨 위 세 줄로
 * 스쳐 지나갔고, 바로 아래에서 카드가 시선을 가져갔다.
 *
 * 이 화면에는 금액과 건수만 둔다. 답변 칩·마감 안내·주석을 함께 두면 정작 큰
 * 숫자가 여러 덩어리 중 하나가 된다. 그 정보들은 다음 화면(목록)이 그대로 갖고
 * 있으므로 흐름에서 사라지지는 않는다.
 *
 * 금액은 합산이 아니라 가장 큰 한 건이다. 중복 수급 제한(exclusiveGroup) 때문에
 * 상한을 더하면 실제로는 받을 수 없는 금액이 되고, 정확한 조합은 계약 조건이
 * 있어야 계산할 수 있다 (lib/benefit.ts 의 largestTotalCeiling 주석). 이 방향은
 * 실제 받을 수 있는 액수를 넘겨 말하지 않는 쪽이라 안전하다 — 조합은 언제나
 * 가장 큰 한 건 이상이다.
 *
 * (docs/기획/2026-08-30-화면-구조-개편-설계.md)
 */

const policies = policiesJson as PolicyMeta[];

export default function FindResultPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [loaded, setLoaded] = useState(false);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAnswers(loadAnswers());
    setAsOf(todayISO());
    setLoaded(true);
  }, []);

  const resolved = resolveAnswers(answers, asOf ?? null);
  const groups = groupPolicies(policies, resolved);
  const count = candidateCount(groups);
  const { 신청가능 } = asOf
    ? splitByApplicationWindow(groups, asOf)
    : { 신청가능: [] };
  const 최대상한 = largestTotalCeiling(신청가능.map((t) => t.policy));
  // 캐릭터 포즈가 결과를 먼저 말한다: 찾았으면 found, 없으면 empty.
  // 한 화면에 한 포즈만 쓴다.
  const 찾음 = 신청가능.length > 0;

  return (
    <AppShell>
      <TopBar backHref="/find" backLabel="질문으로 돌아가기" />

      {!loaded ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <>
          {/* 화면 한가운데. 이 숫자 말고는 볼 것이 없어야 한다. */}
          <main className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
            <PerkyCharacter
              state={찾음 ? "found" : "empty"}
              size={520}
              priority
              className="amount-reveal h-auto w-[min(58vw,240px)]"
            />

            {찾음 ? (
              <div>
                <p
                  className="amount-reveal text-base font-semibold text-ink-500"
                  style={{ animationDelay: "0.04s" }}
                >
                  지금 신청할 수 있는
                </p>
                {최대상한 && (
                  /* 금색은 '받을 수 있는 돈' 신호다. 이 화면에서 이 색을 쓰는 건
                     이 한 줄뿐이라 눈이 여기로 먼저 간다. */
                  <p
                    className="amount-reveal mt-2 text-[46px] font-extrabold leading-none text-accent-600"
                    style={{ animationDelay: "0.12s" }}
                  >
                    {최대상한.label}
                  </p>
                )}
                <h1
                  className={`amount-reveal font-extrabold text-ink-900 ${
                    최대상한 ? "mt-4 text-xl" : "text-[40px] leading-tight"
                  }`}
                  style={{ animationDelay: 최대상한 ? "0.26s" : "0.12s" }}
                >
                  지원금 {신청가능.length}건이 있어요
                </h1>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <h1
                  className="amount-reveal text-balance text-[28px] font-extrabold leading-snug text-ink-900"
                  style={{ animationDelay: "0.04s" }}
                >
                  {count > 0
                    ? "지금 신청할 수 있는 지원금이 없어요"
                    : "아쉽게도 해당되는 지원금이 없어요"}
                </h1>
                {count > 0 && (
                  <p
                    className="amount-reveal text-sm leading-relaxed text-ink-600"
                    style={{ animationDelay: "0.16s" }}
                  >
                    조건에는 맞지만 이번 회차 접수가 모두 끝났습니다. 다음 모집 공고를 기다려야 합니다.
                  </p>
                )}
              </div>
            )}
          </main>

          <StickyBottomAction>
            <LinkButton href="/find/policies">
              {찾음
                ? `지원금 ${신청가능.length}건 자세히 보기`
                : count > 0
                  ? "어떤 지원금이었는지 보기"
                  : "왜 해당되지 않는지 보기"}
            </LinkButton>
          </StickyBottomAction>
        </>
      )}
    </AppShell>
  );
}
