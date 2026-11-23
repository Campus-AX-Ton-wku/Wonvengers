"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Button, Icon3D, StickyBottomAction, TopBar } from "@/app/components";
import { estimatePolicyAmount } from "@/lib/benefit";
import { confirmItems, confirmKey } from "@/lib/confirm";
import { formatKoreanMoney } from "@/lib/money";
import { loadDeclared, saveDeclared } from "@/lib/storage";
import { useResultData } from "../useResultData";
import MissingInput from "../MissingInput";
import { ResultLoading } from "../ResultState";

/**
 * 결과 전 '확인할 것' (11/23 ggue) — 조건을 확인하면 받을 수 있는 금액도 결과 합계에 넣는 대신,
 * 그 조건을 결과를 보기 전에 **반드시** '해당해요' · '해당하지 않아요'로 답하게 한다. '모름'은 없다.
 * 해당해요 → 합계에 남고, 해당하지 않아요 → 빠진다. 답은 직접 답한 조건(perky.declared, 계정에 저장)에.
 *
 * 판정 질문의 마지막 [결과 확인하기]가 여기로 온다. 확인할 것이 없으면 바로 결과로 넘긴다(replace — 뒤로 가면 판정 질문).
 * 결과 화면도 아직 답하지 않은 조건이 있으면 여기로 보낸다(lib/confirm.ts pendingConfirmations).
 * 결과 앞 '찾았어요' 표시(lib/reveal.ts)는 여기서 꺼내지 않는다 — 결과 화면이 꺼낸다.
 */
export default function ConfirmPage() {
  const router = useRouter();
  const { listing, birthDate, summary, status } = useResultData();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [loadedAnswers, setLoadedAnswers] = useState(false);

  const items = listing && summary ? confirmItems(summary, (policy) => estimatePolicyAmount(policy, listing, birthDate)) : [];
  const keys = items.flatMap((item) => item.checks.map((check) => confirmKey(item.policy.id, check.key)));

  useEffect(() => {
    if (loadedAnswers || status === "loading") return;
    const declared = loadDeclared();
    setAnswers(Object.fromEntries(keys.flatMap((k) => (typeof declared[k] === "boolean" ? [[k, declared[k] as boolean]] : []))));
    setLoadedAnswers(true);
    // keys 는 summary 에서 나온다 — 처음 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, loadedAnswers]);

  // 확인할 것이 없으면(빈 · 기간 지남 · 오류 화면 포함) 결과가 알아서 말한다 — 바로 넘긴다
  const nothingToAsk = status !== "loading" && status !== "missing" && items.length === 0;
  useEffect(() => {
    if (nothingToAsk) router.replace("/result");
  }, [nothingToAsk, router]);

  if (status === "missing") return <MissingInput />;
  if (status === "loading" || nothingToAsk || !loadedAnswers) return <ResultLoading />;

  const left = keys.filter((k) => answers[k] === undefined).length;

  function finish() {
    if (left > 0) return;
    for (const key of keys) saveDeclared(key, answers[key]);
    router.replace("/result");
  }

  return (
    <AppShell>
      <TopBar backHref="/eligibility" />
      <main className="step-in flex flex-col gap-5 pb-10 pt-3">
        <header>
          <p className="text-[13px] font-bold text-ink-500">결과 보기 전에</p>
          <h1 className="mt-1 text-[21px] font-extrabold leading-[1.4] text-ink-900">이 조건만 확인해 주세요</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            받을 수 있는 금액이 이 답에 따라 달라져요. 잘 모르면 확인 방법을 보고 답해 주세요 — 답한 조건은 신청할 때 기관이 다시 확인해요.
          </p>
        </header>

        {items.map(({ policy, amount, checks }) => (
          <section key={policy.id} aria-labelledby={`confirm-${policy.id}`} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Icon3D name={policy.icon} size={40} />
              <div className="min-w-0">
                <h2 id={`confirm-${policy.id}`} className="text-base font-extrabold leading-snug text-ink-900">
                  {policy.name}
                </h2>
                <p className="text-xs text-ink-600">
                  해당하면 예상 <strong className="font-extrabold text-brand-900 tabular-nums">{formatKoreanMoney(amount)}</strong>
                </p>
              </div>
            </div>
            {checks.map((check) => {
              const key = confirmKey(policy.id, check.key);
              const value = answers[key];
              return (
                <fieldset key={key} className="flex flex-col gap-2 rounded-control bg-ink-50 p-3.5">
                  <legend className="sr-only">{check.label}</legend>
                  <p aria-hidden="true" className="text-sm font-bold leading-snug text-ink-900">
                    {check.label}
                  </p>
                  {check.howToConfirm && <p className="text-xs leading-relaxed text-ink-600">확인 방법: {check.howToConfirm}</p>}
                  <div role="radiogroup" aria-label={`${check.label} — 해당하나요?`} className="mt-1 grid grid-cols-2 gap-2">
                    {([true, false] as const).map((yes) => (
                      <button
                        key={String(yes)}
                        type="button"
                        role="radio"
                        aria-checked={value === yes}
                        onClick={() => setAnswers((prev) => ({ ...prev, [key]: yes }))}
                        className={`focus-ring min-h-11 rounded-control border text-sm font-bold transition-colors ${
                          value === yes
                            ? "border-brand-600 bg-brand-50 text-brand-800"
                            : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        {yes ? "해당해요" : "해당하지 않아요"}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </section>
        ))}
      </main>
      <StickyBottomAction>
        {left > 0 && (
          <p className="mb-2 text-center text-xs font-semibold text-ink-600" aria-live="polite">
            {left}개 남았어요 — 모두 답해야 결과를 볼 수 있어요
          </p>
        )}
        <Button size="screen" disabled={left > 0} onClick={finish}>
          결과 보기
        </Button>
      </StickyBottomAction>
    </AppShell>
  );
}
