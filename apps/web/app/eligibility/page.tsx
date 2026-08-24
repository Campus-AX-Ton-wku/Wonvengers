"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { EligibilityProfile, PolicyMeta } from "@/lib/types";
import { getRequiredQuestions, type QuestionDef } from "@/lib/questions";
import { MONTH_OPTIONS, birthYearOptions, dayOptions, fromISODate, toISODate } from "@/lib/birth";
import { formatKoreanMoney, manwonToWon, wonToManwon } from "@/lib/money";
import { buildQuestionSteps } from "@/lib/steps";
import { policiesForRegion } from "@/lib/region";
import { loadAnswers, loadListing, loadProfile, saveProfile } from "@/lib/storage";
import { AppBar, BottomCta, OptionButton, StepHeading } from "../Stepper";

const policies = policiesData as PolicyMeta[];

const DEFAULT_PROFILE: EligibilityProfile = {
  birthDate: "",
  isStudentOrEmployed: "unknown",
  livesApartFromParents: "unknown",
  canRegisterResidence: "unknown",
  hasNoHouse: "unknown",
  isContractHolder: "unknown",
  householdSize: "unknown",
  useOriginHousehold: "unknown",
  ownHouseholdMonthlyIncome: "unknown",
  originHouseholdMonthlyIncome: "unknown",
  assetsUnder107M: "unknown",
  isBasicLivelihoodRecipient: "unknown",
  isNearPovertyClass: "unknown",
  receivingOtherRentSupport: "unknown",
  jeonbukResidentOverOneYear: "unknown",
  employedInTargetSectorOver3Months: "unknown",
};

export default function EligibilityPage() {
  const router = useRouter();
  const [region, setRegion] = useState<string | null>(null);
  /** 1층에서 답한 나이. 생년월일을 왜 또 묻는지 설명하는 데 쓴다. */
  const [floor1Age, setFloor1Age] = useState<number | null>(null);
  const [profile, setProfile] = useState<EligibilityProfile>(DEFAULT_PROFILE);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listing = loadListing();
    if (!listing) {
      // 계약 조건 없이는 판정할 수 없다. 홈이 아니라 그 입력을 받는 화면으로 보낸다.
      router.replace("/calculate");
      return;
    }
    setRegion(listing.region);
    setFloor1Age(loadAnswers().age);
    const saved = loadProfile();
    if (saved) setProfile(saved);
  }, [router]);

  // 지역에 해당하지 않는 정책은 후보에서 빠지고, 그 정책만 쓰던 질문도 함께 사라진다.
  // 빠진 질문은 어떤 판정 규칙도 참조하지 않으므로 결과에 영향이 없다.
  const steps = useMemo(() => {
    if (region === null) return [];
    return buildQuestionSteps(getRequiredQuestions(policiesForRegion(policies, region)));
  }, [region]);

  function update<K extends keyof EligibilityProfile>(key: K, value: EligibilityProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function handleNext() {
    const current = steps[step];
    // 생년월일은 나이 요건 때문에 '모름'을 허용하지 않는 유일한 질문이다.
    if (current?.questions.some((q) => q.key === "birthDate") && !profile.birthDate) {
      return setError("생년월일을 입력해주세요.");
    }
    setError(null);
    saveProfile(profile); // 스텝마다 저장 — 새로고침해도 답이 남는다.
    if (step < steps.length - 1) return setStep(step + 1);
    router.push("/result");
  }

  function handleBack() {
    setError(null);
    // 첫 스텝의 직전 화면은 계약 조건이다. 홈으로 내보내면 입력한 계약 조건을
    // 고치려고 처음부터 다시 들어와야 한다.
    if (step === 0) return router.push("/calculate");
    setStep(step - 1);
  }

  if (region === null || steps.length === 0) {
    return <main className="p-10 text-center text-ink-500">불러오는 중...</main>;
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5">
      {/* 계약조건 2스텝이 앞에 있으므로 전체 진행률에 더해서 보여준다. */}
      <AppBar onBack={handleBack} current={step + 3} total={steps.length + 2} />

      <main key={step} className="step-in flex flex-1 flex-col gap-8 py-7">
        <StepHeading emoji={current.emoji} title={current.heading} />

        {/* 1층에서 나이를 답한 사람에게 생년월일을 또 묻는 이유를 말해준다.
            나이만으로는 정책 기준일 기준 만 나이를 계산할 수 없다. */}
        {floor1Age !== null && current.questions.some((q) => q.key === "birthDate") && (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
            앞에서 만 {floor1Age}세라고 답하셨어요. 정책마다 기준일이 달라서, 정확한
            판정에는 생년월일이 필요합니다.
          </p>
        )}

        {current.questions.map((q) => (
          <QuestionField
            key={q.key}
            question={q}
            value={profile[q.key]}
            onChange={(v) => update(q.key, v as never)}
          />
        ))}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </main>

      <BottomCta onClick={handleNext}>{isLast ? "결과 확인하기" : "다음"}</BottomCta>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: QuestionDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const isUnknown = value === "unknown";
  // 라벨을 for/id 로 묶는다. 묶이지 않으면 스크린리더가 입력칸을 이름 없이 읽고,
  // 라벨을 눌러도 칸에 포커스가 가지 않는다.
  const inputId = `q-${question.key}`;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputId} className="text-base font-bold leading-snug text-ink-900">
        {question.label}
      </label>

      {question.type === "date" && (
        <BirthDatePicker
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      )}

      {question.type === "boolean" && (
        <div className="flex flex-col gap-2">
          <OptionButton active={value === true} onClick={() => onChange(true)}>
            그렇다
          </OptionButton>
          <OptionButton active={value === false} onClick={() => onChange(false)}>
            아니다
          </OptionButton>
          {question.allowUnknown && (
            <OptionButton active={isUnknown} onClick={() => onChange("unknown")}>
              모름
            </OptionButton>
          )}
        </div>
      )}

      {/* 빈 칸 = 모름이다. 예전에는 '모름' 을 두 번 누르면 값이 0 이 됐고, 소득 0원은
          모든 소득 상한을 통과해 '예상 적용' 으로 잘못 판정됐다. 칸을 비활성화하지
          않으므로 숫자를 입력하면 모름이 자연스럽게 풀린다. */}
      {question.type === "number" && (
        <div className="flex flex-col gap-2">
          <input
            id={inputId}
            type="number"
            inputMode={question.money ? "decimal" : "numeric"}
            step={question.money ? "any" : 1}
            className="input"
            value={numberFieldValue(question, value)}
            onChange={(e) =>
              onChange(
                e.target.value === ""
                  ? "unknown"
                  : question.money
                    ? manwonToWon(Number(e.target.value))
                    : Number(e.target.value)
              )
            }
            min={0}
          />
          {/* 0 하나 더/덜 친 실수를 그 자리에서 잡는다 (F1-8 과 같은 이유). */}
          {question.money && typeof value === "number" && value > 0 && (
            <p aria-hidden="true" className="text-xs font-semibold text-brand-700">
              {formatKoreanMoney(value)}
            </p>
          )}
          {question.allowUnknown && (
            <OptionButton active={isUnknown} onClick={() => onChange("unknown")}>
              모름
            </OptionButton>
          )}
        </div>
      )}

      {question.type === "select" && (
        <select
          id={inputId}
          className="input"
          value={typeof value === "string" ? value : "unknown"}
          onChange={(e) => onChange(e.target.value)}
        >
          {question.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {question.allowUnknown && <option value="unknown">모름</option>}
        </select>
      )}
    </div>
  );
}

/** 금액 질문은 만원, 나머지(가구원 수 등)는 그대로 보여준다. */
function numberFieldValue(question: QuestionDef, value: unknown): number | "" {
  if (typeof value !== "number") return "";
  return question.money ? (wonToManwon(value) ?? "") : value;
}

/**
 * 생년월일 — 년/월/일 목록에서 고른다.
 *
 * <input type="date"> 는 오늘(2026년)부터 시작해서 청년이 자기 생년까지 19년을
 * 거슬러 올라가야 했다. 목록 맨 위가 만 18세 생년이라 대부분 한두 번만 굴리면 닿는다.
 * 세 칸을 다 고르기 전에는 빈 값으로 둔다 — 반쯤 고른 상태가 날짜로 저장되면 안 된다.
 */
function BirthDatePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  type Parts = { year: number | null; month: number | null; day: number | null };
  const [parts, setParts] = useState<Parts>(
    () => fromISODate(value) ?? { year: null, month: null, day: null }
  );

  // 저장된 프로필은 마운트 뒤에 들어온다 — 그때 목록에도 되살린다.
  useEffect(() => {
    const saved = fromISODate(value);
    if (saved) setParts(saved);
  }, [value]);

  const years = useMemo(() => birthYearOptions(new Date().getFullYear()), []);
  const days = dayOptions(parts.year, parts.month);

  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch };
    // 2월 30일 같은 날짜가 남지 않게 자른다 (3월 31일에서 2월로 바꾼 경우).
    if (next.year !== null && next.month !== null && next.day !== null) {
      next.day = Math.min(next.day, dayOptions(next.year, next.month).length);
    }
    setParts(next);
    onChange(
      next.year !== null && next.month !== null && next.day !== null
        ? toISODate(next.year, next.month, next.day)
        : ""
    );
  }

  const toNumber = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="flex gap-2">
      <select
        id={id}
        className="input flex-[1.3]"
        value={parts.year ?? ""}
        onChange={(e) => update({ year: toNumber(e.target.value) })}
      >
        <option value="">년</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        aria-label="생년월일 월"
        className="input flex-1"
        value={parts.month ?? ""}
        onChange={(e) => update({ month: toNumber(e.target.value) })}
      >
        <option value="">월</option>
        {MONTH_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
      <select
        aria-label="생년월일 일"
        className="input flex-1"
        value={parts.day ?? ""}
        onChange={(e) => update({ day: toNumber(e.target.value) })}
      >
        <option value="">일</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}일
          </option>
        ))}
      </select>
    </div>
  );
}
