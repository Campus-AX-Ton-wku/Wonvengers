"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import exampleListingsData from "@/data/example-listings.json";
import type { ContractType, ExampleListing, ListingInput, PolicyMeta } from "@/lib/types";
import { monthlyRentEquivalent } from "@/lib/rent";
import { contractYearOptions } from "@/lib/date";
import WheelDatePicker from "@/app/WheelDatePicker";
import { formatKoreanMoney, manwonToWon, wonToManwon } from "@/lib/money";
import { exampleBadge, exampleToListing, isVerifiedExample } from "@/lib/examples";
import { loadAnswers, loadListing, saveListing } from "@/lib/storage";
import { REGION_OPTIONS, isRegionValue, policiesForRegion } from "@/lib/region";
import { getRequiredQuestions } from "@/lib/questions";
import { buildQuestionSteps } from "@/lib/steps";
import { AppBar, BottomCta, OptionButton, StepHeading } from "../Stepper";

const policies = policiesData as PolicyMeta[];
const exampleListings = exampleListingsData as ExampleListing[];

const EMPTY: ListingInput = {
  region: "",
  contractType: "연세",
  deposit: 0,
  rentOrYearlyAmount: 0,
  managementFee: 0,
  oneTimeMoveCost: 0,
  contractStartDate: "",
  months: 12,
  sourceType: "중개사 안내",
  confirmedMatchesActualContract: false,
  exampleId: null,
};

export default function InputPage() {
  const router = useRouter();
  const [form, setForm] = useState<ListingInput>(EMPTY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** 1층에서 고른 지역을 그대로 이어받았는지. 사용자에게 알려주기 위한 표시다. */
  const [regionFromFloor1, setRegionFromFloor1] = useState(false);
  /**
   * 계약 형태를 사용자가 실제로 골랐는지 (PRD F1-1: '월세·연세 중 선택하게 한다').
   * 기본값을 하나 켜 두면 월세 계약자가 '연세' 를 그대로 두고 넘어갈 수 있고,
   * 그러면 월 환산액이 1/12 로 줄어 지원금이 크게 어긋난다.
   */
  const [contractTypeChosen, setContractTypeChosen] = useState(false);

  useEffect(() => {
    const saved = loadListing();
    if (saved) {
      // 지역이 자유 입력이던 시절 저장분은 선택지로 매칭되지 않으므로 다시 고르게 한다.
      setForm({ ...saved, region: isRegionValue(saved.region) ? saved.region : "" });
      setContractTypeChosen(true); // 저장된 입력에는 이미 고른 계약 형태가 있다
      return;
    }

    // 2층에 처음 들어온 경우 1층에서 이미 고른 지역을 다시 묻지 않는다.
    // 같은 질문을 두 번 하면 1층과 2층이 별개의 앱처럼 느껴진다.
    const region = loadAnswers().region;
    if (region && isRegionValue(region)) {
      setForm((prev) => ({ ...prev, region }));
      setRegionFromFloor1(true);
    }
  }, []);

  const monthlyEquivalent =
    form.rentOrYearlyAmount > 0 && form.months > 0 ? monthlyRentEquivalent(form) : 0;

  // 뒤에 이어질 판정질문 스텝 수까지 합쳐 전체 진행률을 보여준다.
  const totalSteps = useMemo(() => {
    const scoped = form.region ? policiesForRegion(policies, form.region) : policies;
    return 2 + buildQuestionSteps(getRequiredQuestions(scoped)).length;
  }, [form.region]);

  function update<K extends keyof ListingInput>(key: K, value: ListingInput[K]) {
    if (key === "region") setRegionFromFloor1(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 예시를 불러온 뒤 값을 고쳐도 exampleId 는 지우지 않는다. 절반만 고친 상태에서
  // "예시 데이터" 표시가 사라지면 가상 조건이 실제 입력처럼 보인다.
  function loadExample(example: ExampleListing) {
    setError(null);
    setContractTypeChosen(true); // 예시에는 계약 형태가 들어 있다
    setForm((prev) => exampleToListing(example, prev));
  }

  function clearExample() {
    setError(null);
    setContractTypeChosen(false);
    setForm({ ...EMPTY });
  }

  const activeExample = exampleListings.find((e) => e.id === form.exampleId) ?? null;

  /** 해당 스텝의 입력만 검증한다. 규칙 자체는 기존 handleSubmit 과 동일하다. */
  function validate(current: number): string | null {
    if (current === 0) {
      if (!form.region) return "거주 예정 지역을 선택해주세요.";
      if (!contractTypeChosen) return "계약 형태를 선택해주세요. 월세와 연세는 계산이 다릅니다.";
      // 보증금 0(무보증)·관리비 0 은 정상이지만, 월세·연세가 0 이면 계산할 값이 없다.
      if (form.rentOrYearlyAmount <= 0) {
        return form.contractType === "연세"
          ? "연세 선납액을 입력해주세요."
          : "월세액을 입력해주세요.";
      }
      return null;
    }
    if (!form.contractStartDate) return "계약 시작 예정일을 입력해주세요.";
    if (form.months <= 0) return "거주 예정 개월 수는 1개월 이상이어야 합니다.";
    if (form.managementFee < 0 || form.oneTimeMoveCost < 0) return "금액은 0원 이상이어야 합니다.";
    if (!form.confirmedMatchesActualContract) {
      return "해당 매물의 실제 계약 조건과 일치하는지 확인해주세요.";
    }
    return null;
  }

  function handleNext() {
    const message = validate(step);
    if (message) return setError(message);
    setError(null);
    saveListing(form); // 스텝마다 저장 — 새로고침해도 입력이 남는다.
    if (step === 0) return setStep(1);
    router.push("/eligibility");
  }

  function handleBack() {
    setError(null);
    // 첫 스텝에서는 앱바 화살표가 아무 일도 하지 않았다 — 화살표가 보이는데
    // 반응이 없으면 고장으로 읽힌다. 1층 목록이 직전 화면이다.
    if (step === 0) return router.push("/find/policies");
    setStep(step - 1);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5">
      <AppBar onBack={handleBack} current={step + 1} total={totalSteps} />

      <main key={step} className="step-in flex flex-1 flex-col gap-7 py-7">
        {step === 0 ? (
          <>
            <StepHeading emoji="🏠" title="어떤 방을 보고 계신가요?" />

            {/* F1-11: 발표 시연용 고정 예시. 실제 매물인지 여부를 배지로 그대로 드러낸다. */}
            <section className="rounded-xl border border-ink-200 bg-sand-50 p-4">
              <p className="text-sm font-bold text-ink-700">
                <span aria-hidden="true">✨</span> 예시로 채워보기
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {exampleListings.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => loadExample(e)}
                    className={`rounded-lg border-2 px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
                      form.exampleId === e.id
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>

              {activeExample && (
                <div className="mt-3 rounded-lg bg-white p-3">
                  <p
                    className={`text-xs font-bold ${
                      isVerifiedExample(activeExample) ? "text-ok-700" : "text-warn-800"
                    }`}
                  >
                    {exampleBadge(activeExample)}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{activeExample.note}</p>
                  <button
                    type="button"
                    onClick={clearExample}
                    className="mt-2 text-[11px] font-bold text-ink-500 underline hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    예시 지우고 직접 입력하기
                  </button>
                </div>
              )}
            </section>

            <Field label="거주 예정 지역">
              <select
                className="input"
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
              >
                <option value="">선택해주세요</option>
                {REGION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {regionFromFloor1 && (
                <p className="text-xs font-normal text-brand-700">
                  <span aria-hidden="true">✓</span> 앞에서 고른 지역으로 채웠어요. 바꿔도 됩니다.
                </p>
              )}
            </Field>

            <FieldGroup label="계약 형태">
              <div className="flex flex-col gap-2">
                {(["월세", "연세"] as ContractType[]).map((type) => (
                  <OptionButton
                    key={type}
                    active={contractTypeChosen && form.contractType === type}
                    onClick={() => {
                      setContractTypeChosen(true);
                      update("contractType", type);
                    }}
                  >
                    {type}
                  </OptionButton>
                ))}
              </div>
            </FieldGroup>

            <Field label="보증금 (만원)">
              <NumberInput money value={form.deposit} onChange={(v) => update("deposit", v)} />
            </Field>

            <Field label={form.contractType === "연세" ? "연세 선납액 (만원)" : "월세액 (만원)"}>
              <NumberInput
                money
                value={form.rentOrYearlyAmount}
                onChange={(v) => update("rentOrYearlyAmount", v)}
              />
            </Field>
          </>
        ) : (
          <>
            <StepHeading emoji="🧾" title="비용과 기간을 알려주세요" />

            <Field label="월 관리비 (만원)">
              <NumberInput money value={form.managementFee} onChange={(v) => update("managementFee", v)} />
            </Field>

            {/* ⚠️ 스파이크 — 휠 데이트 피커. 감이 나쁘면 DatePicker(네이티브 select)로
                되돌린다. /eligibility 생년월일은 아직 select 라 나란히 비교할 수 있다. */}
            <FieldGroup label="계약 시작 예정일">
              <WheelDatePicker
                label="계약 시작 예정일"
                years={contractYearOptions(new Date().getFullYear())}
                value={form.contractStartDate}
                onChange={(v) => update("contractStartDate", v)}
              />
            </FieldGroup>

            <Field label="거주 예정 개월 수">
              <NumberInput value={form.months} onChange={(v) => update("months", v)} />
            </Field>

            <Field label="이사비 등 정책이 요구하는 일시 지출 (만원, 없으면 0)">
              <NumberInput
                money
                value={form.oneTimeMoveCost}
                onChange={(v) => update("oneTimeMoveCost", v)}
              />
            </Field>

            {form.contractType === "연세" && monthlyEquivalent > 0 && (
              <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
                연세 {form.rentOrYearlyAmount.toLocaleString()}원 ÷ {form.months}개월 = 월 환산{" "}
                <strong>{monthlyEquivalent.toLocaleString()}원</strong>
              </p>
            )}

            <Field label="이 조건을 어디서 확인했나요?">
              <select
                className="input"
                value={form.sourceType}
                onChange={(e) => update("sourceType", e.target.value as ListingInput["sourceType"])}
              >
                <option value="부동산 광고">부동산 광고</option>
                <option value="중개사 안내">중개사 안내</option>
                <option value="계약서">계약서</option>
                {/* 예시를 불러왔을 때만 노출한다. 직접 고를 수 있는 출처가 아니다. */}
                {form.sourceType === "예시 데이터" && (
                  <option value="예시 데이터">예시 데이터 (실제로 확인한 조건이 아님)</option>
                )}
              </select>
            </Field>

            <label className="flex items-start gap-3 rounded-xl bg-sand-50 px-4 py-4 text-sm leading-relaxed text-ink-600">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
                checked={form.confirmedMatchesActualContract}
                onChange={(e) => update("confirmedMatchesActualContract", e.target.checked)}
              />
              {activeExample && !isVerifiedExample(activeExample)
                ? "위 조건이 실제 계약이 아닌 예시임을 알고, 계산 결과를 확인합니다."
                : "위 조건은 제가 검토 중인 매물의 실제 계약 조건과 일치합니다."}
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </main>

      <BottomCta onClick={handleNext}>다음</BottomCta>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-ink-700">
      {label}
      {children}
    </label>
  );
}

/**
 * 라벨이 붙은 버튼 그룹.
 *
 * Field(<label>)로 감싸면 안 된다 — button 은 labelable 요소라서 첫 버튼이
 * label 전체 텍스트를 자기 접근성 이름으로 가져간다("계약 형태 월세 연세, 버튼").
 */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 text-sm font-semibold text-ink-700">
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * 숫자 입력. 음수는 입력되는 순간 0으로 막고, 금액이면 만·억 단위로 읽어준다 (F1-8).
 * '다음'을 누를 때까지 기다리면 금액 단위 실수를 늦게 알게 된다.
 *
 * money 인 칸은 만원 단위로 주고받는다 — 3 을 넣으면 30,000원이 저장된다.
 * value/onChange 는 그대로 원 단위이므로 계산·저장 쪽은 아무것도 바뀌지 않는다.
 */
function NumberInput({
  value,
  onChange,
  money = false,
}: {
  value: number;
  onChange: (v: number) => void;
  money?: boolean;
}) {
  const shown = money ? wonToManwon(value) : Number.isFinite(value) && value !== 0 ? value : null;
  return (
    <div className="flex flex-col gap-1">
      {/* 0 을 값으로 보여주면 사용자가 지우고 입력해야 한다. 빈 칸 + placeholder 로 둔다. */}
      <input
        type="number"
        inputMode={money ? "decimal" : "numeric"}
        step={money ? "any" : 1}
        className="input"
        value={shown ?? ""}
        onChange={(e) => {
          const typed = Math.max(0, Number(e.target.value) || 0);
          onChange(money ? manwonToWon(typed) : typed);
        }}
        min={0}
        placeholder="0"
      />
      {money && value > 0 && (
        <p aria-hidden="true" className="text-xs font-semibold text-brand-700">
          {formatKoreanMoney(value)}
        </p>
      )}
    </div>
  );
}
