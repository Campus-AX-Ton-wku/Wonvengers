"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { EligibilityProfile, PolicyMeta } from "@/lib/types";
import { getRequiredQuestions, type QuestionDef } from "@/lib/questions";
import { buildQuestionSteps } from "@/lib/steps";
import { policiesForRegion } from "@/lib/region";
import { loadListing, loadProfile, saveProfile } from "@/lib/storage";
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
      router.replace("/");
      return;
    }
    setRegion(listing.region);
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
        <StepHeading
          emoji={current.emoji}
          title={current.heading}
          description="정확히 모르는 값은 추정하지 않아요. '모름'을 고르면 '조건 충족 시 가능'으로 분류하고 확인 방법을 알려드려요."
        />

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
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-base font-bold leading-snug text-ink-900">
          {question.label}
        </label>
        <p className="text-xs leading-relaxed text-ink-500">{question.why}</p>
      </div>

      {question.type === "date" && (
        <input
          id={inputId}
          type="date"
          className="input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
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
            inputMode="numeric"
            className="input"
            value={isUnknown || typeof value !== "number" ? "" : value}
            onChange={(e) => onChange(e.target.value === "" ? "unknown" : Number(e.target.value))}
            min={0}
            placeholder="모르면 비워두세요"
          />
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
