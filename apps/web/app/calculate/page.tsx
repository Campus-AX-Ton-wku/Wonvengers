"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { ContractType, ListingInput, PolicyMeta } from "@/lib/types";
import { monthlyRentEquivalent } from "@/lib/rent";
import { contractYearOptions } from "@/lib/date";
import WheelDatePicker from "@/app/WheelDatePicker";
import { loadAnswers, loadListing, saveListing } from "@/lib/storage";
import { REGION_OPTIONS, isRegionValue, policiesForRegion } from "@/lib/region";
import { getRequiredQuestions } from "@/lib/questions";
import { buildQuestionSteps } from "@/lib/steps";
import {
  AppShell,
  Button,
  ChoiceCard,
  Field,
  FieldError,
  FieldGroup,
  MoneyInput,
  NumberInput,
  StepHeader,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { Check, ICON_SM } from "@/app/components/icons";

const policies = policiesData as PolicyMeta[];

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
  /**
   * 계약 형태를 1층 '주거 형태' 답에서 이어받았는지. 지역과 같은 표시를 붙인다.
   *
   * 기본값을 켜 두는 것과 다르다 — 사용자가 직접 고른 답을 옮겨 오는 것이라
   * F1-1 의 '고르게 한다' 를 어기지 않는다. 그래서 전세·그 외·무응답은 옮기지
   * 않는다: 그 답들은 월세인지 연세인지를 말해주지 않는다.
   */
  const [contractTypeFromFloor1, setContractTypeFromFloor1] = useState(false);

  useEffect(() => {
    const saved = loadListing();
    if (saved) {
      // 지역이 자유 입력이던 시절 저장분은 선택지로 매칭되지 않으므로 다시 고르게 한다.
      setForm({ ...saved, region: isRegionValue(saved.region) ? saved.region : "" });
      setContractTypeChosen(true); // 저장된 입력에는 이미 고른 계약 형태가 있다
      return;
    }

    // 2층에 처음 들어온 경우 1층에서 이미 고른 것을 다시 묻지 않는다.
    // 같은 질문을 두 번 하면 1층과 2층이 별개의 앱처럼 느껴진다.
    const answers = loadAnswers();
    if (answers.region && isRegionValue(answers.region)) {
      setForm((prev) => ({ ...prev, region: answers.region as string }));
      setRegionFromFloor1(true);
    }
    // 주거 형태 중 월세·연세만 계약 형태가 된다. 전세·그 외는 이 화면이 다루는
    // 계약이 아니고, 무응답은 아무것도 말해주지 않는다.
    const housingType = answers.housingType;
    if (housingType === "월세" || housingType === "연세") {
      setForm((prev) => ({ ...prev, contractType: housingType }));
      setContractTypeChosen(true);
      setContractTypeFromFloor1(true);
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
    <AppShell>
      <TopBar onBack={handleBack} backLabel="이전 단계로" />

      <main key={step} className="step-in flex flex-1 flex-col gap-7 py-7">
        {step === 0 ? (
          <>
            <StepHeader title="어떤 방을 보고 계신가요?" />

            <Field
              label="거주 예정 지역"
              hint={regionFromFloor1 ? <CarriedOver>앞에서 고른 지역으로 채웠어요. 바꿔도 됩니다.</CarriedOver> : undefined}
            >
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

            <FieldGroup label="계약 형태">
              <div className="flex flex-col gap-2">
                {(["월세", "연세"] as ContractType[]).map((type) => (
                  <ChoiceCard
                    key={type}
                    active={contractTypeChosen && form.contractType === type}
                    onClick={() => {
                      setContractTypeChosen(true);
                      update("contractType", type);
                    }}
                  >
                    {type}
                  </ChoiceCard>
                ))}
              </div>
              {contractTypeFromFloor1 && (
                <CarriedOver>앞에서 답한 주거 형태로 골랐어요. 바꿔도 됩니다.</CarriedOver>
              )}
            </FieldGroup>

            <Field label="보증금 (만원)">
              <MoneyInput placeholder="0" value={form.deposit} onChange={(v) => update("deposit", v ?? 0)} />
            </Field>

            <Field label={form.contractType === "연세" ? "연세 선납액 (만원)" : "월세액 (만원)"}>
              <MoneyInput
                placeholder="0"
                value={form.rentOrYearlyAmount}
                onChange={(v) => update("rentOrYearlyAmount", v ?? 0)}
              />
            </Field>
          </>
        ) : (
          <>
            <StepHeader title="비용과 기간을 알려주세요" />

            <Field label="월 관리비 (만원)">
              <MoneyInput placeholder="0" value={form.managementFee} onChange={(v) => update("managementFee", v ?? 0)} />
            </Field>

            {/* 휠 데이트 피커. /eligibility 의 생년월일도 같은 컴포넌트를 쓴다 —
                앱 안에 날짜 UI 가 두 종류이면 같은 동작을 두 번 배워야 한다. */}
            <FieldGroup label="계약 시작 예정일">
              <WheelDatePicker
                label="계약 시작 예정일"
                years={contractYearOptions(new Date().getFullYear())}
                value={form.contractStartDate}
                onChange={(v) => update("contractStartDate", v)}
              />
            </FieldGroup>

            <Field label="거주 예정 개월 수">
              <NumberInput
                placeholder="0"
                value={form.months === 0 ? null : form.months}
                onChange={(v) => update("months", v ?? 0)}
              />
            </Field>

            <Field label="이사비 등 정책이 요구하는 일시 지출 (만원, 없으면 0)">
              <MoneyInput
                placeholder="0"
                value={form.oneTimeMoveCost}
                onChange={(v) => update("oneTimeMoveCost", v ?? 0)}
              />
            </Field>

            {form.contractType === "연세" && monthlyEquivalent > 0 && (
              <p className="rounded-control bg-brand-50 px-4 py-3 text-sm text-brand-900">
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

            {/* 계산 결과의 신뢰가 이 한 줄에 걸려 있다(PRD F1-10). 다른 입력칸과
                같은 무게로 두면 습관적으로 지나친다 — 면을 주고 조금 띄워 둔다. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-control bg-ink-50 px-4 py-4 text-sm font-medium leading-relaxed text-ink-700 transition-colors focus-within:ring-4 focus-within:ring-brand-100 hover:bg-brand-50">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer"
                checked={form.confirmedMatchesActualContract}
                onChange={(e) => update("confirmedMatchesActualContract", e.target.checked)}
              />
              위 조건은 제가 검토 중인 매물의 실제 계약 조건과 일치합니다.
            </label>
          </>
        )}

        {error && <FieldError>{error}</FieldError>}
      </main>

      <StickyBottomAction>
        <Button onClick={handleNext}>다음</Button>
      </StickyBottomAction>
    </AppShell>
  );
}

/** 앞 화면의 답을 그대로 옮겨 왔다는 표시. 색만으로 말하지 않도록 체크를 붙인다. */
function CarriedOver({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
      <Check size={ICON_SM - 2} strokeWidth={3} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}
