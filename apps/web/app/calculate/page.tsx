"use client";

import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { ContractType, ListingInput, PolicyMeta } from "@/lib/types";
import type { Icon3DName } from "@/lib/icons3d";
import { YEARLY_RENT_MONTHS, monthlyJeonseInterest, monthlyRentEquivalent } from "@/lib/rent";
import { contractYearOptions } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import WheelDatePicker from "@/app/WheelDatePicker";
import { loadAnswers, loadListing, saveAnswers, saveListing } from "@/lib/storage";
import { REGION_HIERARCHY, isRegionValue, regionDisplayName } from "@/lib/region";
import { getRequiredQuestions } from "@/lib/questions";
import { buildQuestionSteps } from "@/lib/steps";
import { useStepParam } from "@/lib/navigation";
import {
  AnswerSummaryBar,
  AppShell,
  Button,
  CarriedOver,
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
import { ICON_SM, Pencil } from "@/app/components/icons";
import { questionScope } from "@/lib/scope";
import { seoulTodayISO } from "@/lib/date";

const policies = policiesData as PolicyMeta[];

/** 계약 형태 카드 (11/23 전세 추가, ggue A안). 1층 주거 형태 중 '그 외'만 계약 형태가 아니다. */
const CONTRACT_TYPES: { type: ContractType; icon: Icon3DName }[] = [
  { type: "월세", icon: "monthly" },
  { type: "연세", icon: "yearly" },
  { type: "전세", icon: "jeonse" },
];
const isContractType = (v: unknown): v is ContractType => v === "월세" || v === "연세" || v === "전세";
/** 대출 금리 상한(연 %). 저장 형식 검사(user-data.ts)도 30 까지 받는다 — 그 위는 잘못 넣은 값이다. */
const MAX_LOAN_RATE = 30;

/*
 * 이사비·중개보수 칸과 '실제 계약 조건과 일치합니다' 확인은 11/21 뺐다(ggue).
 * oneTimeMoveCost 는 늘 0 이다 — 예전에 저장된 값도 loadListing 이 0 으로 읽는다.
 * 그래서 이사비 지원(lumpSumBasis "oneTimeMoveCost")은 합계에 넣지 않고 공고 상한으로만 보인다.
 * 두 값은 저장 형식(user-data.ts)에 그대로 남겨 둔다 — 형식을 바꾸면 서버 배포가 따라온다.
 */
const EMPTY: ListingInput = {
  region: "",
  contractType: "연세",
  deposit: 0,
  rentOrYearlyAmount: 0,
  managementFee: 0,
  oneTimeMoveCost: 0,
  contractStartDate: "",
  months: 12,
  confirmedMatchesActualContract: false,
};

/** 단계 주소 값(?s=). 사람이 읽는 1·2 다. */
const CALC_STEPS = ["1", "2"] as const;
type CalcStep = (typeof CALC_STEPS)[number];

/** useSearchParams 를 쓰므로 정적 export 에서 본문을 Suspense 안에 둔다. */
export default function InputPage() {
  return (
    <Suspense fallback={<CalculateLoading />}>
      <CalculateSteps />
    </Suspense>
  );
}

function CalculateLoading() {
  return (
    <AppShell>
      <TopBar backHref="/find/policies" />
      <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
    </AppShell>
  );
}

function CalculateSteps() {
  const router = useRouter();
  const [form, setForm] = useState<ListingInput>(EMPTY);
  /** 저장된 입력을 다 불러왔는가. 그 전에 ?s=2 를 판정하면 빈 폼이라 늘 1단계로 튕긴다. */
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 1층에서 고른 지역을 그대로 이어받았는지. 사용자에게 알려주기 위한 표시다. */
  const [regionFromFloor1, setRegionFromFloor1] = useState(false);
  /**
   * 계약 형태를 사용자가 실제로 골랐는지 (PRD F1-1: '월세·연세 중 선택하게 한다', 11/23 전세 추가).
   * 기본값을 하나 켜 두면 월세 계약자가 '연세' 를 그대로 두고 넘어갈 수 있고,
   * 그러면 월 환산액이 1/12 로 줄어 지원금이 크게 어긋난다.
   */
  const [contractTypeChosen, setContractTypeChosen] = useState(false);
  /**
   * 계약 형태를 1층 '주거 형태' 답에서 이어받았는지. 지역과 같은 표시를 붙인다.
   *
   * 기본값을 켜 두는 것과 다르다 — 사용자가 직접 고른 답을 옮겨 오는 것이라
   * F1-1 의 '고르게 한다' 를 어기지 않는다. 그래서 그 외·무응답은 옮기지
   * 않는다: 그 답들은 어떤 계약인지 말해주지 않는다. 전세는 11/23 부터 옮긴다.
   */
  const [contractTypeFromFloor1, setContractTypeFromFloor1] = useState(false);
  /**
   * 이어받은 계약 형태를 고치려고 카드를 펼쳤는지. 이어받은 답은 한 줄로 접어 둔다 —
   * 카드 세 장을 그대로 다시 보여주면 표시가 붙어 있어도 또 묻는 질문처럼 읽힌다.
   */
  const [contractTypeEditing, setContractTypeEditing] = useState(false);
  const contractTypeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadListing();
    const answers = loadAnswers();
    const regionFromAnswers =
      answers.region && isRegionValue(answers.region) ? answers.region : null;
    // 주거 형태 중 월세·연세·전세가 계약 형태가 된다. 그 외는 이 화면이 다루는
    // 계약이 아니고, 무응답은 아무것도 말해주지 않는다.
    const contractTypeFromAnswers: ContractType | null = isContractType(answers.housingType)
      ? answers.housingType
      : null;

    if (saved) {
      // Find에서 고른 지역은 이전 Calculate 저장값보다 최신의 명시적 답변이다.
      // 금액 정보는 유지하되 지역과 계약 형태는 Find 답변을 우선한다. 계약 형태도
      // 지역과 같은 이유다 — 여기서 바꾼 값은 아래 update 가 1층에도 써 두므로, 둘이
      // 다르면 1층에서 나중에 고친 것이다. 저장값이 이기면 방금 고친 답이 사라진다.
      setForm({
        ...saved,
        region: regionFromAnswers ?? (isRegionValue(saved.region) ? saved.region : ""),
        contractType: contractTypeFromAnswers ?? saved.contractType,
      });
      setRegionFromFloor1(regionFromAnswers !== null);
      setContractTypeChosen(true); // 저장된 입력에는 이미 고른 계약 형태가 있다
      setContractTypeFromFloor1(contractTypeFromAnswers !== null);
      setLoaded(true);
      return;
    }

    // 2층에 처음 들어온 경우 1층에서 이미 고른 것을 다시 묻지 않는다.
    // 같은 질문을 두 번 하면 1층과 2층이 별개의 앱처럼 느껴진다.
    if (regionFromAnswers) {
      setForm((prev) => ({ ...prev, region: regionFromAnswers }));
      setRegionFromFloor1(true);
    }
    if (contractTypeFromAnswers) {
      setForm((prev) => ({ ...prev, contractType: contractTypeFromAnswers }));
      setContractTypeChosen(true);
      setContractTypeFromFloor1(true);
    }
    setLoaded(true);
  }, []);

  // 연세는 1년 치로 보고 12로 나눈다(11/21) — 거주 개월 수와 무관하다
  const monthlyEquivalent = form.rentOrYearlyAmount > 0 ? monthlyRentEquivalent(form) : 0;
  const isJeonse = form.contractType === "전세";
  const monthlyInterest = isJeonse ? monthlyJeonseInterest(form) : 0;

  // 뒤에 이어질 판정질문 스텝 수까지 합쳐 전체 진행률을 보여준다.
  // 판정 질문 화면과 같은 범위(lib/scope.ts) — 첫 질문 후보 중 지금 접수 중인 정책의 질문만
  const totalSteps = useMemo(() => {
    const scoped = form.region
      ? questionScope(policies, { region: form.region, contractType: form.contractType }, loadAnswers(), seoulTodayISO())
      : policies;
    return 2 + buildQuestionSteps(getRequiredQuestions(scoped)).length;
  }, [form.region, form.contractType]);

  const { step: stepKey, go } = useStepParam<CalcStep>("s", CALC_STEPS, {
    ready: loaded,
    // 단계별 답 기록이 없으므로 주소가 없으면 지금처럼 첫 단계다.
    firstUnanswered: "1",
    // 1단계가 비었는데 ?s=2 로 바로 들어오면 1단계로 돌린다.
    isReachable: (k) => k === "1" || validate(0) === null,
  });
  /** 화면 분기용 0/1. */
  const step = stepKey === "1" ? 0 : 1;

  // 뒤로가기로 단계가 바뀌면 떠난 단계의 오류 문구를 남기지 않는다.
  useEffect(() => setError(null), [stepKey]);

  // 누른 접힌 줄이 카드로 바뀌며 사라졌다. 포커스를 이어받은 답 카드로 옮긴다 —
  // 안 옮기면 body 로 떨어져 키보드·스크린리더 사용자가 자리를 잃는다 (/eligibility 와 같다).
  useEffect(() => {
    if (!contractTypeEditing) return;
    contractTypeRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [contractTypeEditing]);

  function update<K extends keyof ListingInput>(key: K, value: ListingInput[K]) {
    if (key === "region") {
      setRegionFromFloor1(false);

      // Find를 거쳐 온 사용자가 여기서 지역을 다시 바꾸면 두 화면의 지역을 함께
      // 갱신한다. 그래야 새로고침해도 예전 Find 답변으로 되돌아가지 않는다.
      const answers = loadAnswers();
      if (answers.region) {
        saveAnswers({ ...answers, region: value ? String(value) : null });
      }
    }
    if (key === "contractType") {
      // 지역과 같다. 1층에서 월세·연세·전세라고 답한 사람이 여기서 계약 형태를 바꾸면 1층 답도
      // 그 값으로 맞춘다 — 안 그러면 다음에 들어올 때 1층의 옛 답이 다시 이긴다.
      // 그 외는 건드리지 않는다: 공공임대·기숙사에 사는 사람이 매물을 계산해 봤다고 1층을
      // 바꾸면 '지금 사는 집' 답이 사라진다. 1층을 건너뛴 사람의 답변도 만들지 않는다.
      // (11/23 까지는 2층에 전세가 없어서, 전세라고 답한 사람의 1층을 월세로 바꾸면 전세 전용
      // 정책이 목록에서 말없이 빠졌다 — 그래서 전세도 건드리지 않았다. 이제 2층에서 전세를 고를 수 있다.)
      setContractTypeFromFloor1(false);
      const answers = loadAnswers();
      if (isContractType(answers.housingType)) {
        saveAnswers({ ...answers, housingType: value as ContractType });
      }
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** 해당 스텝의 입력만 검증한다. 규칙 자체는 기존 handleSubmit 과 동일하다. */
  function validate(current: number): string | null {
    if (current === 0) {
      if (!form.region) return "거주 예정 지역을 선택해주세요.";
      if (!contractTypeChosen) return "계약 형태를 선택해주세요.";
      if (form.contractType === "전세") {
        // 전세는 보증금이 곧 계약이다. 대출 0(내 돈으로만 낸 전세)은 정상 — 이자 없이 관리비만 낸다.
        if (form.deposit <= 0) return "전세 보증금을 입력해주세요.";
        const loan = form.jeonseLoanAmount ?? 0;
        if (loan > form.deposit) return "대출 금액은 전세 보증금보다 클 수 없어요.";
        const rate = form.jeonseLoanRate ?? 0;
        if (loan > 0 && rate <= 0) return "대출 금리를 입력해주세요.";
        if (rate > MAX_LOAN_RATE) return `대출 금리는 연 ${MAX_LOAN_RATE}% 이하로 입력해주세요.`;
        return null;
      }
      // 보증금 0(무보증)·관리비 0 은 정상이지만, 월세·연세가 0 이면 계산할 값이 없다.
      if (form.rentOrYearlyAmount <= 0) {
        return form.contractType === "연세"
          ? "연세 선납액을 입력해주세요."
          : "월세액을 입력해주세요.";
      }
      return null;
    }
    if (!form.contractStartDate) return "계약 시작일을 입력해주세요.";
    if (form.months <= 0) return "거주 예정 개월 수는 1개월 이상이어야 합니다.";
    if (form.managementFee < 0) return "금액은 0원 이상이어야 합니다.";
    return null;
  }

  function handleNext() {
    const message = validate(step);
    if (message) return setError(message);
    setError(null);
    saveListing(form); // 스텝마다 저장 — 새로고침해도 입력이 남는다.
    if (step === 0) return go("2");
    router.push("/eligibility");
  }

  return (
    <AppShell>
      <TopBar backHref="/find/policies" />
      {/* 2단계에서 1단계 답이 안 보이면 무엇을 입력했는지 기억에 기대야 한다. 누르면 1단계로.
          계약 형태는 따로 두지 않는다 — 마지막 항목("월세 35만원"·"연세 480만원")이 이미 말한다.
          전세는 "전세 1억원" · "대출 8,000만원 · 연 2.4%" 로 같은 일을 한다. */}
      {step === 1 && (
        <AnswerSummaryBar
          items={[
            { key: "region", label: "거주 예정 지역", value: regionDisplayName(form.region), href: "/calculate?s=1" },
            ...(isJeonse
              ? [
                  { key: "deposit", label: "전세 보증금", value: `전세 ${formatKoreanMoney(form.deposit)}`, href: "/calculate?s=1" },
                  {
                    key: "loan",
                    label: "전세대출",
                    value:
                      (form.jeonseLoanAmount ?? 0) > 0
                        ? `대출 ${formatKoreanMoney(form.jeonseLoanAmount ?? 0)} · 연 ${form.jeonseLoanRate ?? 0}%`
                        : "대출 없음",
                    href: "/calculate?s=1",
                  },
                ]
              : [
                  { key: "deposit", label: "보증금", value: `보증금 ${formatKoreanMoney(form.deposit)}`, href: "/calculate?s=1" },
                  {
                    key: "rent",
                    label: form.contractType,
                    value: `${form.contractType} ${formatKoreanMoney(form.rentOrYearlyAmount)}`,
                    href: "/calculate?s=1",
                  },
                ]),
          ]}
        />
      )}

      <main key={step} className="step-in flex flex-1 flex-col gap-7 py-7">
        {step === 0 ? (
          <>
            <StepHeader title="어떤 방을 보고 계신가요?" />

            <Field
              label="거주 예정 지역"
              hint={regionFromFloor1 ? <CarriedOver>앞에서 골랐어요</CarriedOver> : undefined}
            >
              <select
                className="input"
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
              >
                <option value="">선택해주세요</option>
                {REGION_HIERARCHY.map((province) => (
                  <optgroup key={province.name} label={province.name}>
                    {province.districts.map((district) => (
                      <option key={district.value} value={district.value}>
                        {district.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {contractTypeFromFloor1 && !contractTypeEditing ? (
              <ConfirmedRow
                label="계약 형태"
                value={form.contractType}
                onEdit={() => setContractTypeEditing(true)}
              />
            ) : (
              <FieldGroup label="계약 형태">
                <div ref={contractTypeRef} className="flex flex-col gap-2">
                  {CONTRACT_TYPES.map(({ type, icon }) => (
                    <ChoiceCard
                      key={type}
                      icon={icon}
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
                  <CarriedOver>앞에서 골랐어요</CarriedOver>
                )}
              </FieldGroup>
            )}

            <Field label={isJeonse ? "전세 보증금 (만원)" : "보증금 (만원)"}>
              <MoneyInput placeholder="0" value={form.deposit} onChange={(v) => update("deposit", v ?? 0)} />
            </Field>

            {isJeonse ? (
              <>
                {/* 전세의 매달 나가는 돈은 대출 이자다(lib/rent.ts monthlyJeonseInterest). 보증금은 돌려받는 돈이라 세지 않는다. */}
                <Field label="그중 대출받은 금액 (만원)" hint="대출 없이 전세를 얻었으면 0으로 두세요">
                  <MoneyInput
                    placeholder="0"
                    value={form.jeonseLoanAmount ?? 0}
                    onChange={(v) => update("jeonseLoanAmount", v ?? 0)}
                  />
                </Field>
                {(form.jeonseLoanAmount ?? 0) > 0 && (
                  <Field label="대출 금리 (연 %)" hint="대출 약정서나 은행 앱에서 확인할 수 있어요">
                    <NumberInput
                      decimal
                      placeholder="예: 2.4"
                      value={form.jeonseLoanRate ?? null}
                      onChange={(v) => update("jeonseLoanRate", v ?? undefined)}
                    />
                  </Field>
                )}
              </>
            ) : (
              <Field label={form.contractType === "연세" ? "연세 선납액 (만원)" : "월세액 (만원)"}>
                <MoneyInput
                  placeholder="0"
                  value={form.rentOrYearlyAmount}
                  onChange={(v) => update("rentOrYearlyAmount", v ?? 0)}
                />
              </Field>
            )}
          </>
        ) : (
          <>
            <StepHeader title="비용과 기간을 알려주세요" />

            <Field label="월 관리비 (만원)">
              <MoneyInput placeholder="0" value={form.managementFee} onChange={(v) => update("managementFee", v ?? 0)} />
            </Field>

            {/* 휠 데이트 피커. /eligibility 의 생년월일도 같은 컴포넌트를 쓴다 —
                앱 안에 날짜 UI 가 두 종류이면 같은 동작을 두 번 배워야 한다. */}
            <FieldGroup label="계약 시작일">
              <WheelDatePicker
                label="계약 시작일"
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

            {isJeonse && monthlyInterest > 0 && (
              <p className="rounded-control bg-brand-50 px-4 py-3 text-sm text-brand-900">
                대출 {(form.jeonseLoanAmount ?? 0).toLocaleString()}원 × 연 {form.jeonseLoanRate}% ÷ 12개월 = 월 이자{" "}
                <strong>{monthlyInterest.toLocaleString()}원</strong>
              </p>
            )}

            {form.contractType === "연세" && monthlyEquivalent > 0 && (
              <p className="rounded-control bg-brand-50 px-4 py-3 text-sm text-brand-900">
                연세 {form.rentOrYearlyAmount.toLocaleString()}원 ÷ {YEARLY_RENT_MONTHS}개월 = 월 환산{" "}
                <strong>{monthlyEquivalent.toLocaleString()}원</strong>
              </p>
            )}
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

/**
 * 1층에서 이미 답한 것을 한 줄로 보여준다. 누르면 고칠 수 있게 펼친다.
 *
 * /eligibility 의 접힌 줄과 같은 모양이다 — 같은 앱 안에서 "답한 것" 이 같은 모습이어야
 * 처음 보는 화면에서도 눌러서 고칠 수 있다는 걸 안다. 다른 점은 '앞에서 답했어요' 표시다:
 * 이 화면에서 답한 적이 없는데 답이 들어 있으면 왜 그런지 말해야 한다.
 */
function ConfirmedRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  // aria-label 이 버튼 안 글자를 대신 읽으므로 '앞에서 답했어요' 는 설명으로 따로 묶는다.
  // 안 묶으면 스크린리더 사용자는 왜 답이 들어 있는지 듣지 못한다.
  const noteId = useId();
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${label} 고치기: ${value}`}
      aria-describedby={noteId}
      className="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-2.5 text-left shadow-card transition-colors hover:bg-brand-50"
    >
      <span className="min-w-0 truncate text-sm">
        <span className="font-semibold text-ink-500">{label}</span>
        <span aria-hidden="true" className="px-1.5 text-ink-300">
          ·
        </span>
        <span className="font-bold text-ink-900">{value}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {/* 눈에는 보이지 않는다(11/20) — 요약 줄 자체가 앞에서 답한 값을 보여 준다. 스크린리더에는 설명으로 남긴다. */}
        <span id={noteId} className="sr-only">
          앞에서 답했어요
        </span>
        <Pencil size={ICON_SM} aria-hidden="true" className="text-ink-300" />
      </span>
    </button>
  );
}
