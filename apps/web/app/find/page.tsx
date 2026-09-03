"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import WheelDatePicker from "@/app/WheelDatePicker";
import { AGE_MIN, POLICY_AGE_MAX, resolveAnswers } from "@/lib/age";
import { birthYearOptions } from "@/lib/birth";
import { candidateCount, groupPolicies } from "@/lib/discovery";
import { todayISO, fromISODate } from "@/lib/date";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  loadAnsweredKeys,
  saveAnswers,
  saveAnsweredKeys,
  type AnsweredKey,
} from "@/lib/storage";
import type {
  DiscoveryAnswers,
  DiscoveryStatus,
  HousingType,
  IncomeBracket,
  PolicyMeta,
} from "@/lib/types";
import {
  REGION_HIERARCHY,
  REGION_OPTIONS,
  isRegionValue,
  provinceForRegion,
} from "@/lib/region";
import { AnsweredStack, AppBar, BottomCta, OptionButton, StepHeading } from "@/app/Stepper";

/**
 * 1층 · 발견 — 질문 다섯 개를 한 번에 하나씩 묻는다.
 *
 * 예전에는 여러 질문을 테두리 친 카드로 한 화면에 쌓았다. 답한 것과 안 한 것이
 * 같은 무게로 보였고, 화면이 상자로 가득 차 어디부터 봐야 할지 말해주지 않았다.
 *
 * 지금은 질문이 곧 화면 제목이고, 답한 질문은 아래로 밀려 라벨/값 두 줄로 쌓인다.
 * 쌓인 줄이 진행률 표시를 대신하고(그래서 상단에 진행바가 없다), 각 줄을 누르면
 * 그 질문으로 돌아간다 — 목록 화면의 '답변 고치기' 가 여기로 온다.
 *
 * (docs/기획/2026-08-30-화면-구조-개편-설계.md)
 */

const brackets = bracketsJson as IncomeBracket[];
const policies = policiesJson as PolicyMeta[];
const STATUSES: DiscoveryStatus[] = ["대학생", "재직", "구직"];
/**
 * 주거 형태. 연세는 월세와 따로 둔다 — 대학가의 실제 관행이고 2층이 월 환산해
 * 계산하는 계약이다 (types.ts 의 HousingType 주석). '모름' 버튼은 두지 않는다.
 */
const HOUSING_TYPES: { value: HousingType; label: string }[] = [
  { value: "월세", label: "월세" },
  { value: "연세", label: "연세 (1년치 선납)" },
  { value: "전세", label: "전세" },
  { value: "그 외", label: "그 외 (공공임대 · 기숙사 · 가족과 거주 등)" },
];

/** 질문 순서. 줄바꿈은 화면 폭에 맞춰 StepHeading이 균형 있게 처리한다. */
const QUESTIONS = [
  { key: "birthDate", label: "생년월일", title: "생년월일이 어떻게 되시나요?" },
  { key: "region", label: "사는 곳", title: "어디에 살거나 살 예정인가요?" },
  { key: "status", label: "현재 상태", title: "현재 상태가 어떻게 되시나요?" },
  { key: "incomeBracket", label: "월 소득", title: "본인의 월 소득은 어느 정도인가요?" },
  { key: "housingType", label: "주거 형태", title: "현재 어떤 형태로 거주하고 있나요?" },
] as const satisfies readonly { key: AnsweredKey; label: string; title: string }[];

const QUESTION_KEYS = QUESTIONS.map((q) => q.key);

/** 쌓인 줄과 요약 칩이 같은 어휘를 쓰도록 지역 라벨은 REGION_OPTIONS 에서만 온다. */
const regionLabel = (value: string | null) =>
  REGION_OPTIONS.find((o) => o.value === value)?.chipLabel ?? null;

const bracketLabel = (bracket: number | null) =>
  brackets.find((b) => b.bracket === bracket)?.label ?? null;

/** 저장된 생년월일을 사람이 읽는 형태로. 나이는 기준일이 있어야 하므로 따로 붙인다. */
function birthDateLabel(birthDate: string | null, age: number | null): string | null {
  const parts = birthDate === null ? null : fromISODate(birthDate);
  if (!parts) return null;
  const 날짜 = `${parts.year}년 ${parts.month}월 ${parts.day}일`;
  return age === null ? 날짜 : `${날짜} · 만 ${age}세`;
}

export default function FindPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  /** 지역 질문 안에서 먼저 고른 시·도. 시군구를 고르기 전에는 답으로 저장하지 않는다. */
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  /**
   * 실제로 답한 질문. 예전 저장값을 안전하게 정리하면서도 완료한 순서를 유지한다.
   * (lib/storage.ts의 loadAnsweredKeys 주석 참고).
   */
  const [answered, setAnswered] = useState<AnsweredKey[]>([]);

  // 서버 렌더링 후 브라우저에서 저장된 답변을 불러온다.
  useEffect(() => {
    const loadedAnswers = loadAnswers();
    // 예전의 '그 외 지역'·'전북(익산 외)'·모름 저장값은 현재 시군구 답이 아니다.
    // 그대로 통과시키면 사용자가 새 선택지를 보지도 않고 예전의 넓은 지역으로 판정된다.
    const saved = {
      ...loadedAnswers,
      region:
        loadedAnswers.region && isRegionValue(loadedAnswers.region)
          ? loadedAnswers.region
          : null,
    };
    const savedKeys = loadAnsweredKeys().filter((key) => saved[key] !== null);
    setAnswers(saved);
    setAnswered(savedKeys);
    setSelectedProvince(provinceForRegion(saved.region)?.name ?? null);
    if (saved.region !== loadedAnswers.region) saveAnswers(saved);
    saveAnsweredKeys(savedKeys);
    setAsOf(todayISO());

    // 답을 다 한 사람은 마지막 단계로 보낸다. 거기 앞선 네 줄이 전부 쌓여 있어서 그
    // 자체가 답변 요약이자 수정 진입점이 된다. 아직 남았으면 그 첫 질문으로.
    const 미답 = QUESTION_KEYS.findIndex((k) => !savedKeys.includes(k));
    setStep(미답 === -1 ? QUESTION_KEYS.length - 1 : 미답);
    setLoaded(true);
  }, []);

  function update(key: AnsweredKey, patch: Partial<DiscoveryAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveAnswers(next);

    if (!answered.includes(key)) {
      const nextKeys = [...answered, key];
      setAnswered(nextKeys);
      saveAnsweredKeys(nextKeys);
    }
  }

  // 판정 코드는 나이만 본다. 생년월일 → 만 나이 변환은 여기 한 곳에서만 한다.
  const resolved = resolveAnswers(answers, asOf ?? null);
  const groups = groupPolicies(policies, resolved);
  const count = candidateCount(groups);
  // Find에서는 모든 질문을 실제 값으로 답해야 하므로 요약에 '모름'을 만들지 않는다.
  const 답변줄 = [
    birthDateLabel(answers.birthDate, resolved.age),
    regionLabel(answers.region),
    answers.status,
    bracketLabel(answers.incomeBracket),
    answers.housingType,
  ];

  /** 지금 질문보다 앞선 것 중 답한 것만, 가장 최근에 답한 것이 위로 오게 쌓는다. */
  const 쌓인답 = QUESTIONS.slice(0, step)
    .map((q, i) => ({
      label: q.label,
      value: answered.includes(q.key) ? 답변줄[i] : null,
      onEdit: () => {
        if (q.key === "region") {
          setSelectedProvince(provinceForRegion(answers.region)?.name ?? null);
        }
        setStep(i);
      },
    }))
    .reverse();

  const isLast = step === QUESTIONS.length - 1;
  const currentKey = QUESTIONS[step].key;
  const hasCurrentAnswer =
    answered.includes(currentKey) &&
    answers[currentKey] !== null &&
    (currentKey !== "region" ||
      provinceForRegion(answers.region)?.name === selectedProvince);

  function handleBack() {
    // 시군구 목록에서는 이전 질문이 아니라 같은 지역 질문의 시도 목록으로 돌아간다.
    if (step === 1 && selectedProvince !== null) {
      setSelectedProvince(null);
      return;
    }
    if (step === 0) return router.push("/");
    setStep(step - 1);
  }

  function handleNext() {
    if (!hasCurrentAnswer) return;
    // 마지막 답을 하면 결과 요약으로. 목록은 그 다음이다.
    if (isLast) return router.push("/find/result");
    setStep(step + 1);
  }

  if (!loaded) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5">
        <AppBar onBack={() => router.push("/")} />
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </div>
    );
  }

  const current = QUESTIONS[step];
  const province = REGION_HIERARCHY.find((item) => item.name === selectedProvince) ?? null;
  const heading =
    step === 1
      ? province
        ? `${province.name}의 시·군·구를 선택해주세요`
        : "먼저 시·도를 선택해주세요"
      : current.title;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5">
      <AppBar onBack={handleBack} />

      {/* pb-24 는 하단 고정 CTA 높이만큼. 없으면 마지막으로 쌓인 답이 CTA 뒤에 깔린다. */}
      <main key={step} className="step-in flex flex-1 flex-col gap-7 pb-28 pt-7">
        <StepHeading title={heading} />

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <WheelDatePicker
              label="생년월일"
              years={birthYearOptions(new Date().getFullYear())}
              value={answers.birthDate ?? ""}
              onChange={(birthDate) => update("birthDate", { birthDate })}
              /* 아직 안 고른 사람에게는 펼친 채로 연다. 고치러 되돌아온 사람에게는
                 접어 둔다 — 이미 값이 보이는데 휠까지 펴면 화면만 시끄럽다. */
              defaultOpen={answers.birthDate === null}
            />
            {/* 대상 연령은 고르기 전부터 말해준다. 자격 조건을 입력 옵션에 얹으면
                41세가 39세를 고른다 — 받을 수 없는 금액을 받을 수 있다고 믿게 된다. */}
            <p className="text-sm leading-relaxed text-ink-500">
              지금 담고 있는 정책은 대부분 만 {AGE_MIN}~{POLICY_AGE_MAX}세를 대상으로 합니다.
            </p>
            {answers.birthDate !== null && count === 0 && (
              <p className="rounded-xl bg-warn-50 p-4 text-sm leading-relaxed text-warn-800">
                이 나이로는 해당되는 지원금이 없습니다. 목록에서 정책별로 왜 해당되지
                않는지 볼 수 있습니다.
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-2">
            {province === null
              ? REGION_HIERARCHY.map((item) => (
                  <OptionButton
                    key={item.name}
                    active={false}
                    onClick={() => setSelectedProvince(item.name)}
                  >
                    {item.name}
                  </OptionButton>
                ))
              : province.districts.map((district) => (
                  <OptionButton
                    key={district.value}
                    active={answers.region === district.value}
                    onClick={() => update("region", { region: district.value })}
                  >
                    {district.label === province.name
                      ? district.label
                      : district.label.slice(province.name.length + 1)}
                  </OptionButton>
                ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {STATUSES.map((s) => (
              <OptionButton
                key={s}
                active={answers.status === s}
                onClick={() => update("status", { status: s })}
              >
                {s}
              </OptionButton>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2">
            {brackets.map((b) => (
              <OptionButton
                key={b.bracket}
                active={answers.incomeBracket === b.bracket}
                onClick={() => update("incomeBracket", { incomeBracket: b.bracket })}
              >
                {b.label}
              </OptionButton>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2">
            {HOUSING_TYPES.map((h) => (
              <OptionButton
                key={h.value}
                active={answers.housingType === h.value}
                onClick={() => update("housingType", { housingType: h.value })}
              >
                {h.label}
              </OptionButton>
            ))}
          </div>
        )}

        <AnsweredStack items={쌓인답} />
      </main>

      <BottomCta onClick={handleNext} disabled={!hasCurrentAnswer}>
        다음
      </BottomCta>
    </div>
  );
}
