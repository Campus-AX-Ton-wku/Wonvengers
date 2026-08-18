"use client";

import { useEffect, useState } from "react";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import { tagPolicy } from "@/lib/filter";
import PolicyCard from "@/app/find/PolicyCard";
import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "@/lib/storage";
import type { Answers, IncomeBracket, Policy, Region, Status } from "@/lib/types";

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as Policy[];
const REGIONS: Region[] = ["익산시", "전라북도 (익산 외)", "그 외 지역"];
const STATUSES: Status[] = ["대학생", "재직", "구직"];

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "rounded-lg border-2 border-sky-600 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-700"
          : "rounded-lg border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600"
      }
    >
      {label}
    </button>
  );
}

function Question({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold text-sky-600">질문 {step}</p>
      <h2 className="mt-1 text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export default function FindPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);

  // 서버 렌더링 후 브라우저에서 저장된 답변을 불러온다.
  useEffect(() => {
    setAnswers(loadAnswers());
  }, []);

  function update(patch: Partial<Answers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveAnswers(next);
  }

  const tagged = policies.map((policy) => ({
    policy,
    result: tagPolicy(policy, answers),
  }));
  const 가능 = tagged.filter((t) => t.result.tag === "가능성 있음");
  const 확인 = tagged.filter((t) => t.result.tag === "확인 필요");
  const 해당없음 = tagged.filter((t) => t.result.tag === "해당 없음");

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">
        내 지원금 찾기
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        네 가지만 답하면 됩니다. 모르는 건 <strong>모름</strong>을 눌러도
        괜찮습니다 — 대신 해당 정책은 &lsquo;확인 필요&rsquo;로 표시됩니다.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Question
          step={1}
          title="나이가 어떻게 되시나요?"
          hint="대부분의 청년 정책이 나이로 대상을 정합니다."
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={answers.age ?? ""}
            onChange={(e) =>
              update({ age: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="예: 22"
            className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm"
          />
          <Choice
            label="모름"
            selected={answers.age === null}
            onClick={() => update({ age: null })}
          />
        </Question>

        <Question
          step={2}
          title="어디에 살거나 살 예정인가요?"
          hint="지자체 정책은 거주 지역에 따라 대상이 달라집니다."
        >
          {REGIONS.map((r) => (
            <Choice
              key={r}
              label={r}
              selected={answers.region === r}
              onClick={() => update({ region: r })}
            />
          ))}
          <Choice
            label="모름"
            selected={answers.region === null}
            onClick={() => update({ region: null })}
          />
        </Question>

        <Question
          step={3}
          title="현재 상태에 가까운 것은?"
          hint="정책마다 대상으로 하는 신분이 다릅니다."
        >
          {STATUSES.map((s) => (
            <Choice
              key={s}
              label={s}
              selected={answers.status === s}
              onClick={() => update({ status: s })}
            />
          ))}
          <Choice
            label="모름"
            selected={answers.status === null}
            onClick={() => update({ status: null })}
          />
        </Question>

        <Question
          step={4}
          title="본인의 월 소득은 어느 정도인가요?"
          hint="정확한 금액이 아니어도 됩니다. 세전 기준으로 가까운 구간을 고르세요."
        >
          {brackets.map((b) => (
            <Choice
              key={b.bracket}
              label={b.label}
              selected={answers.incomeBracket === b.bracket}
              onClick={() => update({ incomeBracket: b.bracket })}
            />
          ))}
          <Choice
            label="모름"
            selected={answers.incomeBracket === null}
            onClick={() => update({ incomeBracket: null })}
          />
        </Question>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-extrabold text-slate-900">
          지원금 {가능.length + 확인.length}건
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          나이 · 지역 · 상태 · 소득 구간만 비교한 결과입니다. 각 정책의
          나머지 조건은 카드의 &lsquo;추가로 확인할 것&rsquo;을 보세요.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {[...가능, ...확인].map(({ policy, result }) => (
            <PolicyCard key={policy.id} policy={policy} result={result} />
          ))}
        </div>

        {가능.length + 확인.length === 0 && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
            입력한 조건에 해당하는 지원금을 찾지 못했습니다. 답변을 바꿔
            다시 확인해 보세요.
          </p>
        )}

        {해당없음.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-bold text-slate-500">
              해당되지 않는 지원금 {해당없음.length}건 보기
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {해당없음.map(({ policy, result }) => (
                <PolicyCard key={policy.id} policy={policy} result={result} />
              ))}
            </div>
          </details>
        )}

        {tagged.some((t) => t.policy.tier === 2 && t.result.tag !== "해당 없음") ? (
          <div className="mt-6 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-5">
            <p className="text-sm font-bold text-sky-900">
              실제 부담 계산은 준비 중입니다
            </p>
            <p className="mt-1 text-xs leading-relaxed text-sky-800">
              계약 조건을 넣으면 지원금을 반영한 최종 주거비를 계산하는
              기능을 만들고 있습니다. 지금은 위 목록의 공식 페이지에서 조건을
              확인해 주세요.
            </p>
          </div>
        ) : null}

        <p className="mt-8 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600">
          이 화면은 나이 · 지역 · 현재 상태 · 소득 구간만 비교한 결과이며,
          <strong> 신청 자격을 확정하는 것이 아닙니다.</strong> 무주택 여부,
          가구 소득, 복지 자격 등 남은 조건과 최종 지원 여부는 각 기관이
          심사해 결정합니다. 반드시 공식 페이지에서 확인하세요.
        </p>
      </div>
    </main>
  );
}
