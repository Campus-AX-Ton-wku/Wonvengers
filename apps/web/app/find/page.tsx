"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import FindTopBar from "@/app/find/FindTopBar";
import WheelDatePicker from "@/app/WheelDatePicker";
import { AGE_MIN, POLICY_AGE_MAX, isAgeOutOfRange, resolveAnswers } from "@/lib/age";
import { birthYearOptions } from "@/lib/birth";
import { candidateCount, groupPolicies, splitByApplicationWindow } from "@/lib/discovery";
import { todayISO } from "@/lib/date";
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
  children,
}: {
  step: number;
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <p className="text-xs font-bold text-brand-600">질문 {step}</p>
      {/* 이모지는 톤을 위한 장식이다. 스크린리더가 "생일 케이크"를 읽으면 방해만 된다. */}
      <h2 className="mt-1 text-base font-bold text-ink-900">
        <span aria-hidden="true">{emoji}</span> {title}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/**
 * 생년월일 입력. 2층(/eligibility)·계약일과 같은 휠 피커를 쓴다.
 *
 * 나이를 숫자로 고르게 하지 않는 이유가 둘이다.
 *
 * 하나, 나이를 저장하면 시간이 지나며 조용히 거짓이 된다. 만 39세로 저장된 사람이
 * 반년 뒤에도 39세로 판정된다. 정책은 신청일 기준 만 나이로 자르므로 그 차이가
 * 실제로 결과를 가른다.
 *
 * 둘, 나이 목록에는 자격 판정을 붙일 자리가 생긴다. 실제로 붙어 있었다 —
 * <optgroup> 라벨이 "해당되는 지원금 없음 (만 40세 이상)" 이었다. 나이는 고르는
 * 선택지가 아니라 이미 정해진 사실인데, 그 사실에 판정을 얹으면 41세가 39세를
 * 고르게 된다. 받을 수 없는 금액을 받을 수 있다고 믿는 쪽이 훨씬 나쁘다.
 * 대상 연령은 아래 안내문이 고르기 전부터 말해준다.
 */
function BirthDatePicker({
  birthDate,
  onChange,
}: {
  birthDate: string | null;
  onChange: (birthDate: string) => void;
}) {
  return (
    <WheelDatePicker
      label="생년월일"
      years={birthYearOptions(new Date().getFullYear())}
      value={birthDate ?? ""}
      onChange={onChange}
    />
  );
}

export default function FindPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  // 서버 렌더링 후 브라우저에서 저장된 답변을 불러온다.
  useEffect(() => {
    setAnswers(loadAnswers());
    setAsOf(todayISO());
  }, []);

  function update(patch: Partial<DiscoveryAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveAnswers(next);
  }

  // 판정 코드는 나이만 본다. 생년월일 → 만 나이 변환은 여기 한 곳에서만 한다.
  // asOf 가 아직 없는 첫 렌더(서버)에서는 나이도 '모름'이다.
  const resolved = resolveAnswers(answers, asOf ?? null);

  // 목록 화면과 같은 함수로 센다. 따로 계산하면 CTA 건수와 목록 건수가 어긋난다.
  const groups = groupPolicies(policies, resolved);
  const count = candidateCount(groups);
  // 접수가 끝난 정책도 후보에 들어간다. 한 숫자로 말하면 "지금 3건 받을 수 있다"
  // 로 읽히므로 목록 화면과 같은 기준으로 갈라 센다 (lib/discovery.ts 주석 참고).
  const { 신청가능, 마감 } = asOf
    ? splitByApplicationWindow(groups, asOf)
    : { 신청가능: [], 마감: [] };

  return (
    <main className="step-in mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-4">
      <FindTopBar />

      <h1 className="mt-6 text-2xl font-extrabold text-ink-900">내 지원금 찾기</h1>

      <div className="mb-6 mt-5 flex flex-col gap-4">
        <Question
          step={1}
          emoji="🎂"
          title="생년월일이 어떻게 되시나요?"
        >
          <div className="w-full">
            <BirthDatePicker
              birthDate={answers.birthDate}
              onChange={(birthDate) => update({ birthDate })}
            />
          </div>

          {/* 대상 연령은 고르기 전부터 말해준다. 자격 조건은 입력 옵션이 아니라
              필드 밖 안내문이 맡는다 — BirthDatePicker 주석 참고. */}
          <p className="w-full text-xs leading-relaxed text-ink-500">
            {resolved.age !== null && (
              <span className="font-bold text-ink-900">만 {resolved.age}세 · </span>
            )}
            지금 담고 있는 정책은 만 {AGE_MIN}~{POLICY_AGE_MAX}세를 대상으로 합니다.
          </p>

          {isAgeOutOfRange(resolved.age) && (
            <p className="w-full rounded-lg bg-warn-50 p-3 text-xs leading-relaxed text-warn-800">
              이 나이로는 해당되는 지원금이 없습니다. 목록에서 정책별로 왜 해당되지 않는지
              볼 수 있습니다.
            </p>
          )}
        </Question>

        <Question
          step={2}
          emoji="📍"
          title="어디에 살거나 살 예정인가요?"
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
          {/* 숫자는 지금 신청할 수 있는 것만 센다. 후보가 전부 마감이면 '왜 해당되지
              않는지 보기' 로 보내면 안 된다 — 대상이 아니라는 뜻으로 읽히지만 실제로는
              다음 회차를 기다리면 되는 상황이다. */}
          {신청가능.length > 0
            ? `지원금 ${신청가능.length}건 보기`
            : 마감.length > 0
              ? `마감된 지원금 ${마감.length}건 보기`
              : "왜 해당되지 않는지 보기"}
        </Link>
        <p className="mt-2 text-center text-xs text-ink-500">
          {count === 0
            ? "지금 답변으로는 해당되는 지원금이 없습니다"
            : 신청가능.length === 0
              ? "지금 신청할 수 있는 지원금이 없습니다 · 다음 모집 공고를 기다려야 합니다"
              : 마감.length > 0
                ? `접수 마감 ${마감.length}건도 함께 볼 수 있어요`
                : `가능성 있음 ${groups.가능.length}건 · 확인 필요 ${groups.확인.length}건`}
        </p>
      </div>
    </main>
  );
}
