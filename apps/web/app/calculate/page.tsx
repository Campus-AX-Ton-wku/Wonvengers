"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import exampleListingsData from "@/data/example-listings.json";
import type { ContractType, ExampleListing, ListingInput, PolicyMeta } from "@/lib/types";
import { monthlyRentEquivalent } from "@/lib/rent";
import { formatKoreanMoney } from "@/lib/money";
import { exampleBadge, exampleToListing, isVerifiedExample } from "@/lib/examples";
import { loadListing, saveListing } from "@/lib/storage";
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

  useEffect(() => {
    const saved = loadListing();
    if (!saved) return;
    // 지역이 자유 입력이던 시절 저장분은 선택지로 매칭되지 않으므로 다시 고르게 한다.
    setForm({ ...saved, region: isRegionValue(saved.region) ? saved.region : "" });
  }, []);

  const monthlyEquivalent =
    form.rentOrYearlyAmount > 0 && form.months > 0 ? monthlyRentEquivalent(form) : 0;

  // 뒤에 이어질 판정질문 스텝 수까지 합쳐 전체 진행률을 보여준다.
  const totalSteps = useMemo(() => {
    const scoped = form.region ? policiesForRegion(policies, form.region) : policies;
    return 2 + buildQuestionSteps(getRequiredQuestions(scoped)).length;
  }, [form.region]);

  function update<K extends keyof ListingInput>(key: K, value: ListingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 예시를 불러온 뒤 값을 고쳐도 exampleId 는 지우지 않는다. 절반만 고친 상태에서
  // "예시 데이터" 표시가 사라지면 가상 조건이 실제 입력처럼 보인다.
  function loadExample(example: ExampleListing) {
    setError(null);
    setForm((prev) => exampleToListing(example, prev));
  }

  function clearExample() {
    setError(null);
    setForm({ ...EMPTY });
  }

  const activeExample = exampleListings.find((e) => e.id === form.exampleId) ?? null;

  /** 해당 스텝의 입력만 검증한다. 규칙 자체는 기존 handleSubmit 과 동일하다. */
  function validate(current: number): string | null {
    if (current === 0) {
      if (!form.region) return "거주 예정 지역을 선택해주세요.";
      if (form.deposit < 0 || form.rentOrYearlyAmount < 0) return "금액은 0원 이상이어야 합니다.";
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
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5">
      <AppBar onBack={handleBack} current={step + 1} total={totalSteps} />

      <main key={step} className="step-in flex flex-1 flex-col gap-7 py-7">
        {step === 0 ? (
          <>
            <StepHeading
              title={"어떤 방을 보고 계신가요?"}
              description="계약 조건을 넣으면 받을 수 있는 지원금을 반영해 실제 부담액을 계산해드려요."
            />

            {/* F1-11: 발표 시연용 고정 예시. 실제 매물인지 여부를 배지로 그대로 드러낸다. */}
            <section className="rounded-xl border border-ink-200 bg-sand-50 p-4">
              <p className="text-sm font-bold text-ink-700">예시로 채워보기</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                직접 입력하기 전에 예시 조건으로 결과를 먼저 볼 수 있어요.
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
            </Field>

            <Field label="계약 형태">
              <div className="flex flex-col gap-2">
                {(["연세", "월세"] as ContractType[]).map((type) => (
                  <OptionButton
                    key={type}
                    active={form.contractType === type}
                    onClick={() => update("contractType", type)}
                  >
                    {type}
                  </OptionButton>
                ))}
              </div>
            </Field>

            <Field label="보증금 (원)">
              <NumberInput money value={form.deposit} onChange={(v) => update("deposit", v)} />
            </Field>

            <Field label={form.contractType === "연세" ? "연세 선납액 (원)" : "월세액 (원)"}>
              <NumberInput
                money
                value={form.rentOrYearlyAmount}
                onChange={(v) => update("rentOrYearlyAmount", v)}
              />
            </Field>
          </>
        ) : (
          <>
            <StepHeading
              title={"비용과 기간을 알려주세요"}
              description="관리비와 이사비까지 넣어야 실제로 나가는 돈을 정확히 계산할 수 있어요."
            />

            <Field label="월 관리비 (원)">
              <NumberInput money value={form.managementFee} onChange={(v) => update("managementFee", v)} />
            </Field>

            <Field label="계약 시작 예정일">
              <input
                type="date"
                className="input"
                value={form.contractStartDate}
                onChange={(e) => update("contractStartDate", e.target.value)}
              />
            </Field>

            <Field label="거주 예정 개월 수">
              <NumberInput value={form.months} onChange={(v) => update("months", v)} />
            </Field>

            <Field label="이사비 등 정책이 요구하는 일시 지출 (원, 없으면 0)">
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

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
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
 * 숫자 입력. 음수는 입력되는 순간 0으로 막고, 금액이면 만·억 단위로 읽어준다 (F1-8).
 * '다음'을 누를 때까지 기다리면 금액 단위 실수를 늦게 알게 된다.
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
  return (
    <div className="flex flex-col gap-1">
      <input
        type="number"
        inputMode="numeric"
        className="input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        min={0}
      />
      {money && value > 0 && (
        <p className="text-xs font-semibold text-brand-700">{formatKoreanMoney(value)}</p>
      )}
    </div>
  );
}
