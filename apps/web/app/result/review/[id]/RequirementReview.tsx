"use client";

import { useEffect, useState } from "react";
import {
  AppShell,
  LinkButton,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { ExternalLink, ICON_SM, Info, TriangleAlert } from "@/app/components/icons";
import { todayISO } from "@/lib/date";
import { evaluatePolicy } from "@/lib/eligibility";
import { loadListing, loadProfile } from "@/lib/storage";
import type { CheckOutcome, PolicyMeta } from "@/lib/types";

type ReviewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; checks: CheckOutcome[] };

/**
 * 결과 카드에서 고른 정책 하나의 '확인 필요' 조건만 보여준다.
 *
 * /eligibility를 다시 열면 이미 답한 공통 질문까지 전부 반복된다. 반면 여기 오는
 * 조건에는 앱이 입력받지 않는 공고 요건도 있으므로, 현재 판정 결과의 unknown 체크를
 * 그대로 추려 조건명과 확인 방법을 분리해서 안내한다.
 */
export default function RequirementReview({ policy }: { policy: PolicyMeta }) {
  const [state, setState] = useState<ReviewState>({ kind: "loading" });

  useEffect(() => {
    const listing = loadListing();
    const profile = loadProfile();
    if (!listing || !profile) {
      setState({ kind: "missing" });
      return;
    }

    const result = evaluatePolicy(policy, profile, listing, todayISO());
    setState({
      kind: "ready",
      checks: result.checks.filter((check) => check.result === "unknown"),
    });
  }, [policy]);

  if (state.kind === "loading") {
    return (
      <AppShell>
        <TopBar backHref="/result" backLabel="결과로 돌아가기" />
        <p className="mt-10 text-center text-sm text-ink-500" role="status">
          확인할 조건을 불러오는 중…
        </p>
      </AppShell>
    );
  }

  if (state.kind === "missing") {
    return (
      <AppShell>
        <TopBar backHref="/result" backLabel="결과로 돌아가기" />
        <main className="flex flex-1 flex-col justify-center py-10 text-center">
          <h1 className="text-xl font-extrabold text-ink-900">저장된 입력을 찾지 못했어요</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            계약 조건과 자격 정보를 입력한 뒤 다시 확인해주세요.
          </p>
          <LinkButton href="/calculate" className="mt-5">
            조건 입력하기
          </LinkButton>
        </main>
      </AppShell>
    );
  }

  const { checks } = state;

  return (
    <AppShell className="step-in">
      <TopBar backHref="/result" backLabel="결과로 돌아가기" />

      <main className="flex flex-1 flex-col gap-5 pb-28 pt-5">
        <header>
          <p className="text-xs font-bold text-warn-800">{policy.name}</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-snug text-ink-900">
            {checks.length > 0
              ? `${checks.length}가지 조건만 확인하세요`
              : "확인이 필요한 조건이 없어요"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            이미 입력한 조건은 제외했습니다. 아래 항목은 서류나 공식 공고에서 직접 확인해야 해요.
          </p>
        </header>

        {checks.length > 0 && (
          <ol className="flex flex-col gap-3" aria-label={`확인 필요 조건 ${checks.length}개`}>
            {checks.map((check, index) => (
              <li key={check.key} className="rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warn-800 text-sm font-extrabold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-warn-800">확인할 조건</p>
                    <h2 className="mt-0.5 text-base font-extrabold leading-snug text-ink-900">
                      {check.label}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 rounded-control bg-warn-50 px-4 py-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-warn-800">
                    <TriangleAlert size={ICON_SM} aria-hidden="true" />
                    어떤 점을 확인해야 하나요?
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                    {check.howToConfirm ?? "정확한 기준과 제출 서류를 공식 공고에서 확인하세요."}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex gap-2.5 rounded-card bg-ink-100 p-4">
          <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <p className="text-xs leading-relaxed text-ink-600">
            이 화면은 확인할 항목을 빠뜨리지 않도록 정리한 안내입니다. 최종 자격은 제출 서류를
            심사한 담당 기관이 결정합니다.
          </p>
        </div>

        <a
          href={policy.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-control text-sm font-bold text-brand-700 underline"
        >
          공식 공고에서 확인하기
          <ExternalLink size={ICON_SM} aria-hidden="true" />
        </a>
      </main>

      <StickyBottomAction>
        <LinkButton href="/result" size="screen">
          결과로 돌아가기
        </LinkButton>
      </StickyBottomAction>
    </AppShell>
  );
}
