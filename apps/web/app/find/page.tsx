"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import FindTopBar from "@/app/find/FindTopBar";
import { MinusIcon, PlusIcon } from "@/app/icons";
import { AGE_MAX, AGE_MIN, isAgeOutOfRange, parseAgeInput, stepAge } from "@/lib/age";
import { candidateCount, groupPolicies } from "@/lib/discovery";
import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "@/lib/storage";
import type { DiscoveryAnswers, DiscoveryStatus, IncomeBracket, PolicyMeta } from "@/lib/types";
import { REGION_OPTIONS } from "@/lib/region";

/**
 * 1층 · 발견 — 질문만 있는 화면.
 *
 * 목록은 /find/policies 로 분리했다. 질문 4개와 지원금 카드를 한 화면에 쌓아두면
 * 정보량에 눌린다는 판단이고, 2층에서 같은 이유로 스텝을 나눈 것과 같은 결정이다.
 * (lib/steps.ts 주석 참고)
 */

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as PolicyMeta[];
// 2층과 같은 지역 어휘를 쓴다 (lib/region.ts 단일 출처).
const REGIONS = REGION_OPTIONS;
const STATUSES: DiscoveryStatus[] = ["대학생", "재직", "구직"];

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

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
      className={`rounded-lg border-2 px-4 py-2.5 text-sm transition-colors ${FOCUS_RING} ${
        selected
          ? "border-brand-600 bg-brand-50 font-bold text-brand-900"
          : "border-ink-200 bg-white font-medium text-ink-600 hover:border-brand-300 hover:bg-brand-50"
      }`}
    >
      {label}
    </button>
  );
}

function Question({
  step,
  emoji,
  title,
  hint,
  children,
}: {
  step: number;
  emoji: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <p className="text-xs font-bold text-brand-600">질문 {step}</p>
      {/* 이모지는 톤을 위한 장식이다. 스크린리더가 "생일 케이크"를 읽으면 방해만 된다. */}
      <h2 className="mt-1 text-base font-bold text-ink-900">
        <span aria-hidden="true">{emoji}</span> {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/** 나이 스테퍼. 브라우저 기본 스핀 버튼은 숨기고 −/+ 로 직접 다룬다 (lib/age.ts 참고). */
function AgeStepper({
  age,
  onChange,
}: {
  age: number | null;
  onChange: (age: number | null) => void;
}) {
  const button = `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-ink-200 bg-white text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 active:bg-brand-50 ${FOCUS_RING}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(stepAge(age, -1))} aria-label="나이 1살 내리기" className={button}>
        <MinusIcon size={20} />
      </button>
      <div className="flex items-baseline gap-1 rounded-lg border-2 border-ink-200 bg-white px-3 py-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200">
        <input
          type="number"
          inputMode="numeric"
          min={AGE_MIN}
          max={AGE_MAX}
          value={age ?? ""}
          onChange={(e) => onChange(parseAgeInput(e.target.value))}
          placeholder="22"
          aria-label="나이"
          className="w-12 bg-transparent text-center text-base font-bold text-ink-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm font-semibold text-ink-500">세</span>
      </div>
      <button type="button" onClick={() => onChange(stepAge(age, 1))} aria-label="나이 1살 올리기" className={button}>
        <PlusIcon size={20} />
      </button>
    </div>
  );
}

export default function FindPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);

  // 서버 렌더링 후 브라우저에서 저장된 답변을 불러온다.
  useEffect(() => {
    setAnswers(loadAnswers());
  }, []);

  function update(patch: Partial<DiscoveryAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveAnswers(next);
  }

  // 목록 화면과 같은 함수로 센다. 따로 계산하면 CTA 건수와 목록 건수가 어긋난다.
  const groups = groupPolicies(policies, answers);
  const count = candidateCount(groups);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-4">
      <FindTopBar />

      <h1 className="mt-6 text-2xl font-extrabold text-ink-900">내 지원금 찾기</h1>

      <div className="mb-6 mt-5 flex flex-col gap-4">
        <Question
          step={1}
          emoji="🎂"
          title="나이가 어떻게 되시나요?"
          hint="대부분의 청년 정책이 나이로 대상을 정합니다. 만 나이로 답해주세요."
        >
          <AgeStepper age={answers.age} onChange={(age) => update({ age })} />
          <Choice
            label="모름"
            selected={answers.age === null}
            onClick={() => update({ age: null })}
          />
          {isAgeOutOfRange(answers.age) && (
            <p className="w-full rounded-lg bg-warn-50 p-3 text-xs leading-relaxed text-warn-800">
              지금 담고 있는 정책은 만 {AGE_MIN}~39세를 대상으로 합니다. 이 나이로는
              해당되는 지원금이 없습니다.
            </p>
          )}
        </Question>

        <Question
          step={2}
          emoji="📍"
          title="어디에 살거나 살 예정인가요?"
          hint="지자체 정책은 거주 지역에 따라 대상이 달라집니다."
        >
          {REGIONS.map((r) => (
            <Choice
              key={r.value}
              label={r.label}
              selected={answers.region === r.value}
              onClick={() => update({ region: r.value })}
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
          emoji="🎓"
          title="현재 상태가 어떻게 되시나요?"
          hint="재학·재직 여부에 따라 대상이 갈리는 정책이 있습니다."
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
          emoji="💰"
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

      {/* 답변을 바꿀 때마다 건수가 바로 바뀐다. 목록으로 넘어가지 않아도 반응이 보인다. */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Link
          href="/find/policies"
          className={`block rounded-xl bg-brand-600 py-4 text-center text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.99] active:bg-brand-700 ${FOCUS_RING}`}
        >
          {count > 0 ? `지원금 ${count}건 보기` : "왜 해당되지 않는지 보기"}
        </Link>
        <p className="mt-2 text-center text-xs text-ink-500">
          {count > 0
            ? `가능성 있음 ${groups.가능.length}건 · 확인 필요 ${groups.확인.length}건`
            : "지금 답변으로는 해당되는 지원금이 없습니다"}
        </p>
      </div>
    </main>
  );
}
