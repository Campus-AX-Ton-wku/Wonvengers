"use client";

import { useEffect, useState } from "react";
import {
  AppShell,
  ChoiceCard,
  LinkButton,
  MoneyInput,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { Check, ExternalLink, ICON_SM, Info, TriangleAlert, X } from "@/app/components/icons";
import WheelDatePicker from "@/app/WheelDatePicker";
import { todayISO } from "@/lib/date";
import { evaluatePolicy } from "@/lib/eligibility";
import { loadDeclared, loadListing, loadProfile, saveDeclared } from "@/lib/storage";
import type {
  CheckOutcome,
  DeclaredValue,
  EligibilityProfile,
  ListingInput,
  PolicyMeta,
} from "@/lib/types";

type ReviewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; profile: EligibilityProfile; listing: ListingInput };

/**
 * 결과 카드에서 고른 정책 하나의 '확인 필요' 조건만 묻고 고치게 한다.
 *
 * /eligibility를 다시 열면 이미 답한 공통 질문까지 전부 반복된다. 여기서는 그 정책의
 * check 중 ask 가 붙은 것 — 판정 질문이 받지 않아 사용자가 직접 답해야 하는 조건 —
 * 만 그린다. 답은 perky.declared 에 저장되고 같은 화면에서 바로 다시 판정한다.
 */
export default function RequirementReview({ policy }: { policy: PolicyMeta }) {
  const [state, setState] = useState<ReviewState>({ kind: "loading" });
  const [declared, setDeclared] = useState<Record<string, DeclaredValue>>({});

  useEffect(() => {
    const listing = loadListing();
    const profile = loadProfile();
    if (!listing || !profile) {
      setState({ kind: "missing" });
      return;
    }
    setDeclared(loadDeclared());
    setState({ kind: "ready", profile, listing });
  }, []);

  function answer(key: string, value: DeclaredValue | undefined) {
    saveDeclared(key, value);
    setDeclared(loadDeclared());
  }

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

  // 저장된 답을 얹어 다시 판정한다. 화면의 pass/fail 과 결과 화면의 숫자가 같은
  // 함수에서 나와야 둘이 어긋나지 않는다.
  const result = evaluatePolicy(
    policy,
    { ...state.profile, selfDeclared: declared },
    state.listing,
    todayISO()
  );
  const askable = result.checks.filter((check) => check.ask);
  const remaining = askable.filter((check) => check.result === "unknown").length;

  return (
    <AppShell className="step-in">
      <TopBar backHref="/result" backLabel="결과로 돌아가기" />

      <main className="flex flex-1 flex-col gap-5 pb-28 pt-5">
        <header>
          <p className="text-xs font-bold text-warn-800">{policy.name}</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-snug text-ink-900">
            {remaining > 0 ? `${remaining}가지만 답하면 돼요` : "확인이 필요한 조건을 모두 답했어요"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {askable.length > 0
              ? "이미 입력한 조건은 제외했습니다. 아래 항목만 답하면 결과에 바로 반영돼요. 답은 언제든 고칠 수 있습니다."
              : "이 정책은 입력하신 정보만으로 판정할 수 있어 따로 답할 조건이 없습니다."}
          </p>
        </header>

        {askable.length > 0 && (
          <ol className="flex flex-col gap-3" aria-label={`확인 필요 조건 ${askable.length}개`}>
            {askable.map((check, index) => (
              <li key={check.key} className="rounded-card bg-surface p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <StepMark index={index} result={check.result} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-warn-800">확인할 조건</p>
                    <h2 className="mt-0.5 text-base font-extrabold leading-snug text-ink-900">
                      {check.label}
                    </h2>
                  </div>
                </div>

                <div className="mt-4">
                  <AnswerInput check={check} value={declared[check.key]} onAnswer={answer} />
                </div>

                {check.result !== "unknown" && (
                  <Verdict result={check.result} onReset={() => answer(check.key, undefined)} />
                )}

                {check.howToConfirm && (
                  <div className="mt-3 rounded-control bg-warn-50 px-4 py-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-warn-800">
                      <TriangleAlert size={ICON_SM} aria-hidden="true" />
                      어떤 점을 확인해야 하나요?
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{check.howToConfirm}</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="flex gap-2.5 rounded-card bg-ink-100 p-4">
          <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <p className="text-xs leading-relaxed text-ink-600">
            여기 답한 값은 이 브라우저에만 저장되고 결과 판정에 바로 쓰입니다. 직접 신고한 값이므로
            최종 자격은 제출 서류를 심사한 담당 기관이 결정합니다.
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

/** 순번 동그라미. 답을 마친 조건은 번호 대신 결과를 보여준다. */
function StepMark({ index, result }: { index: number; result: CheckOutcome["result"] }) {
  const tone =
    result === "pass" ? "bg-accent-700" : result === "fail" ? "bg-danger-700" : "bg-warn-800";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${tone}`}
    >
      {result === "pass" ? (
        <Check size={ICON_SM} aria-hidden="true" />
      ) : result === "fail" ? (
        <X size={ICON_SM} aria-hidden="true" />
      ) : (
        index + 1
      )}
    </span>
  );
}

/** 답한 뒤의 판정 한 줄. 잘못 눌렀을 때 되돌릴 길을 같이 준다. */
function Verdict({ result, onReset }: { result: "pass" | "fail"; onReset: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p
        role="status"
        className={`text-sm font-bold ${result === "pass" ? "text-accent-700" : "text-danger-700"}`}
      >
        {result === "pass" ? "이 조건은 충족해요" : "이 조건은 충족하지 않아요"}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="focus-ring min-h-11 rounded-control px-2 text-xs font-bold text-ink-500 underline"
      >
        답 지우기
      </button>
    </div>
  );
}

/** 조건이 요구하는 입력 한 칸. 종류는 규칙(check.ask.kind)이 정한다. */
function AnswerInput({
  check,
  value,
  onAnswer,
}: {
  check: CheckOutcome;
  value: DeclaredValue | undefined;
  onAnswer: (key: string, value: DeclaredValue | undefined) => void;
}) {
  const ask = check.ask;
  if (!ask) return null;

  if (ask.kind === "yesno") {
    return (
      <div role="group" aria-label={ask.prompt} className="flex flex-col gap-2">
        <span className="text-sm font-bold text-ink-700">{ask.prompt}</span>
        <ChoiceCard active={value === true} onClick={() => onAnswer(check.key, true)}>
          예
        </ChoiceCard>
        <ChoiceCard active={value === false} onClick={() => onAnswer(check.key, false)}>
          아니오
        </ChoiceCard>
      </div>
    );
  }

  if (ask.kind === "money") {
    // <label> 로 감싸지 않는다. MoneyInput 이 칸 아래 붙이는 "2억 8,000만원" 까지
    // 라벨 텍스트로 딸려 들어가 접근성 이름이 질문+금액이 된다.
    const inputId = `ask-${check.key}`;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-bold text-ink-700">
          {ask.prompt}
        </label>
        <MoneyInput
          id={inputId}
          value={typeof value === "number" ? value : null}
          onChange={(won) => onAnswer(check.key, won ?? undefined)}
        />
      </div>
    );
  }

  return (
    <WheelDatePicker
      label={ask.prompt}
      years={ask.years ?? []}
      value={typeof value === "string" ? value : ""}
      onChange={(iso) => onAnswer(check.key, iso === "" ? undefined : iso)}
    />
  );
}
