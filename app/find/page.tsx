"use client";

import { useEffect, useState } from "react";
import bracketsJson from "@/data/income-brackets.json";
import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "@/lib/storage";
import type { Answers, IncomeBracket, Region, Status } from "@/lib/types";

const brackets = bracketsJson as IncomeBracket[];
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

      {/* Task 6 에서 이 자리에 정책 목록이 들어간다 */}
      <pre className="mt-6 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify(answers, null, 2)}
      </pre>
    </main>
  );
}
