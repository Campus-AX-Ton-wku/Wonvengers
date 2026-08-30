"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { EligibilityProfile, PolicyMeta } from "@/lib/types";
import { getRequiredQuestions, type QuestionDef } from "@/lib/questions";
import { birthYearOptions } from "@/lib/birth";
import WheelDatePicker from "@/app/WheelDatePicker";
import { formatKoreanMoney, manwonToWon, wonToManwon } from "@/lib/money";
import { buildQuestionSteps } from "@/lib/steps";
import { policiesForRegion } from "@/lib/region";
import { loadAnswers, loadListing, loadProfile, saveAnswers, saveProfile } from "@/lib/storage";
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

    // 생년월일은 1층과 2층이 나눠 갖는 값이 아니라 하나다. 1층 답을 소스 오브
    // 트루스로 삼아 여기서는 다시 묻지 않고 채워 둔다 — 고치는 건 그대로 된다
    // (handleNext 가 고친 값을 1층 답변에도 써서 둘을 붙여 둔다).
    //
    // 저장된 프로필이 이기게 두면 안 된다: 1층에서 답하고 2층에 들렀다가 다시
    // 1층으로 돌아가 날짜를 고치고 오면, 방금 고친 값이 옛 프로필에 막힌다.
    const saved = loadProfile() ?? DEFAULT_PROFILE;
    const 일층생년월일 = loadAnswers().birthDate;
    setProfile({ ...saved, birthDate: 일층생년월일 ?? saved.birthDate });
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

    // 여기서 고친 생년월일을 1층 답변에도 써 둔다. 1층 답을 프리필의 기준으로
    // 삼았으므로, 안 써 두면 다음에 이 화면에 들어올 때 1층의 옛 값이 다시 이겨서
    // 방금 한 수정이 사라진다. 두 화면이 같은 값을 보게 붙여 두는 것이다.
    if (profile.birthDate) {
      const answers = loadAnswers();
      if (answers.birthDate !== profile.birthDate) {
        saveAnswers({ ...answers, birthDate: profile.birthDate });
      }
    }
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
      <AppBar onBack={handleBack} />

      <main key={step} className="step-in flex flex-1 flex-col gap-8 py-7">
        <StepHeading title={current.heading} />

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

      {/* 생년월일 — 계약 시작 예정일과 같은 휠 피커를 쓴다. 앱 안에 날짜 UI 가
          두 종류이면 같은 동작을 두 번 배워야 한다.
          연도는 최신 생년(만 18세)이 맨 위다. <input type="date"> 는 오늘(2026)부터
          시작해서 청년이 19년을 거슬러 올라가야 했다. */}
      {question.type === "date" && (
        <WheelDatePicker
          id={inputId}
          label={question.label}
          years={birthYearOptions(new Date().getFullYear())}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
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
