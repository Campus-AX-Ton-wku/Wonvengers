"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import { RegionSummary } from "@/app/find/ConsultCenters";
import WheelDatePicker from "@/app/WheelDatePicker";
import { AGE_MIN, POLICY_AGE_MAX, resolveAnswers } from "@/lib/age";
import { birthYearOptions } from "@/lib/birth";
import { candidateCount, groupPolicies } from "@/lib/discovery";
import { todayISO, fromISODate } from "@/lib/date";
import { stepHref, useStepParam } from "@/lib/navigation";
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
  isRegionValue,
  provinceForRegion,
  regionDisplayName,
} from "@/lib/region";
import {
  AnswerSummaryBar,
  AppShell,
  Button,
  ChoiceCard,
  StepHeader,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { ICON_SM, TriangleAlert } from "@/app/components/icons";

/**
 * 1층 · 발견 — 질문 다섯 개를 한 번에 하나씩 묻는다.
 *
 * 예전에는 여러 질문을 테두리 친 카드로 한 화면에 쌓았다. 답한 것과 안 한 것이
 * 같은 무게로 보였고, 화면이 상자로 가득 차 어디부터 봐야 할지 말해주지 않았다.
 *
 * 지금은 질문이 곧 화면 제목이고, 단계는 주소(?q=)에 있다. "다음" 이 기록을 하나씩
 * 쌓아서 휴대폰 뒤로가기와 왼쪽 위 화살표가 이전 질문으로 간다. 지역 질문의 시·도 →
 * 시·군·구도 주소(&p=)로 나눠서 뒤로가기가 시·도 목록으로 돌아온다.
 * 답한 것은 상단바 아래 한 줄(AnswerSummaryBar)에 고정된다 — 아래로 쌓으면 긴 목록에 밀려 안 보였다.
 *
 * (docs/기획/2026-08-30-화면-구조-개편-설계.md, docs/기획/2026-11-03-단계-이동-설계.md)
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

/**
 * 질문 순서. step 이 주소 값(?q=)이다 — 사람이 읽을 수 있는 짧은 영어로 둔다.
 * 줄바꿈은 화면 폭에 맞춰 StepHeader가 균형 있게 처리한다.
 */
const QUESTIONS = [
  { key: "birthDate", step: "birth", label: "생년월일", title: "생년월일이 어떻게 되시나요?" },
  { key: "region", step: "region", label: "사는 곳", title: "어디에 살거나 살 예정인가요?" },
  { key: "status", step: "status", label: "현재 상태", title: "현재 상태가 어떻게 되시나요?" },
  { key: "incomeBracket", step: "income", label: "월 소득", title: "본인의 월 소득은 어느 정도인가요?" },
  { key: "housingType", step: "housing", label: "주거 형태", title: "현재 어떤 형태로 거주하고 있나요?" },
] as const satisfies readonly { key: AnsweredKey; step: string; label: string; title: string }[];

type FindStep = (typeof QUESTIONS)[number]["step"];
const STEP_KEYS: readonly FindStep[] = QUESTIONS.map((q) => q.step);

const bracketLabel = (bracket: number | null) =>
  brackets.find((b) => b.bracket === bracket)?.label ?? null;

/**
 * 요약 줄의 생년월일. 한 줄에 다섯 답이 들어가야 하므로 날짜 대신 만 나이를 쓴다.
 * 나이는 기준일이 있어야 하므로 그 전에는 날짜를 보여준다.
 */
function birthChipLabel(birthDate: string | null, age: number | null): string | null {
  const parts = birthDate === null ? null : fromISODate(birthDate);
  if (!parts) return null;
  return age === null ? `${parts.year}년 ${parts.month}월 ${parts.day}일` : `만 ${age}세`;
}

/** useSearchParams 를 쓰므로 정적 export 에서 본문을 Suspense 안에 둔다. 경계 밖 HTML 은 불러오는 중 화면이다. */
export default function FindPage() {
  return (
    <Suspense fallback={<FindLoading />}>
      <FindSteps />
    </Suspense>
  );
}

function FindLoading() {
  return (
    <AppShell>
      <TopBar backHref="/" />
      <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
    </AppShell>
  );
}

function FindSteps() {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
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
    if (saved.region !== loadedAnswers.region) saveAnswers(saved);
    saveAnsweredKeys(savedKeys);
    setAsOf(todayISO());
    setLoaded(true);
  }, []);

  // 주소에 단계가 없으면 첫 미답 질문으로, 다 답했으면 마지막 질문으로 replace 한다.
  // 마지막 단계에는 앞선 네 답이 다 보여서 그 자체가 답변 요약이자 수정 진입점이 된다.
  const 미답 = QUESTIONS.findIndex((q) => !answered.includes(q.key));
  const { step: stepKey, query, go } = useStepParam("q", STEP_KEYS, {
    ready: loaded,
    firstUnanswered: QUESTIONS[미답 === -1 ? QUESTIONS.length - 1 : 미답].step,
    // 앞 질문을 건너뛴 주소(예: 생년월일 없이 ?q=income)로는 들어올 수 없다.
    isReachable: (k) =>
      QUESTIONS.slice(0, STEP_KEYS.indexOf(k)).every((q) => answered.includes(q.key)),
  });
  const step = STEP_KEYS.indexOf(stepKey);
  /** 지역 질문 안에서 먼저 고른 시·도. 주소(p)에 있어서 뒤로가기가 시·도 목록으로 돌아온다. */
  const province =
    step === 1 ? (REGION_HIERARCHY.find((item) => item.name === query("p")) ?? null) : null;
  /** 이미 답한 시·군·구의 시·도. 시·도 목록에서 그 카드를 선택된 것으로 보여준다. */
  const answeredProvince = provinceForRegion(answers.region);

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
  const 요약값 = [
    birthChipLabel(answers.birthDate, resolved.age),
    answers.region ? regionDisplayName(answers.region) : null,
    answers.status,
    bracketLabel(answers.incomeBracket),
    answers.housingType,
  ];

  /** 지금 질문보다 앞서 답한 것만, 질문 순서대로. 누르면 그 질문 주소로 간다(기록에 남는다). */
  const summary = QUESTIONS.slice(0, step).flatMap((q, i) => {
    const value = answered.includes(q.key) ? 요약값[i] : null;
    if (value === null) return [];
    // 사는 곳은 시·군·구 목록으로 바로 연다 — 고치러 온 사람은 대개 같은 시·도 안에서 고친다.
    const extra = q.key === "region" && answeredProvince ? { p: answeredProvince.name } : undefined;
    return [{ key: q.key, label: q.label, value, href: stepHref("/find", "q", q.step, extra) }];
  });

  const isLast = step === QUESTIONS.length - 1;
  const currentKey = QUESTIONS[step].key;
  // 시·도 목록에서는 이미 답한 지역이 있으면 그대로 넘어갈 수 있다. 다른 시·도의 시·군·구
  // 목록을 연 상태에서는 그 안에서 새로 골라야 한다.
  const hasCurrentAnswer =
    answered.includes(currentKey) &&
    answers[currentKey] !== null &&
    (currentKey !== "region" || province === null || answeredProvince?.name === province.name);

  function handleNext() {
    if (!hasCurrentAnswer) return;
    // 마지막 답을 하면 결과 요약으로. 목록은 그 다음이다.
    if (isLast) return router.push("/find/result");
    go(QUESTIONS[step + 1].step);
  }

  if (!loaded) return <FindLoading />;

  const current = QUESTIONS[step];
  const heading =
    step === 1
      ? province
        ? `${province.name}의 시·군·구를 선택해주세요`
        : "먼저 시·도를 선택해주세요"
      : current.title;

  return (
    <AppShell>
      <TopBar backHref="/" />
      <AnswerSummaryBar items={summary} />

      <main key={`${stepKey}-${province?.name ?? ""}`} className="step-in flex flex-1 flex-col gap-7 pb-8 pt-7">
        <StepHeader title={heading} />

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
              <p className="flex items-start gap-2 rounded-control bg-warn-50 p-4 text-sm leading-relaxed text-warn-800">
                <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>
                  이 나이로는 해당되는 지원금이 없습니다. 목록에서 정책별로 왜 해당되지
                  않는지 볼 수 있습니다.
                </span>
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-2">
            {province === null
              ? REGION_HIERARCHY.map((item) => (
                  <ChoiceCard
                    key={item.name}
                    active={answeredProvince?.name === item.name}
                    onClick={() => go("region", { p: item.name })}
                  >
                    {item.name}
                  </ChoiceCard>
                ))
              : province.districts.map((district) => (
                  <ChoiceCard
                    key={district.value}
                    active={answers.region === district.value}
                    onClick={() => update("region", { region: district.value })}
                  >
                    {district.label === province.name
                      ? district.label
                      : district.label.slice(province.name.length + 1)}
                  </ChoiceCard>
                ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {STATUSES.map((s) => (
              <ChoiceCard
                key={s}
                active={answers.status === s}
                onClick={() => update("status", { status: s })}
              >
                {s}
              </ChoiceCard>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2">
            {brackets.map((b) => (
              <ChoiceCard
                key={b.bracket}
                active={answers.incomeBracket === b.bracket}
                onClick={() => update("incomeBracket", { incomeBracket: b.bracket })}
              >
                {b.label}
              </ChoiceCard>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2">
            {HOUSING_TYPES.map((h) => (
              <ChoiceCard
                key={h.value}
                active={answers.housingType === h.value}
                onClick={() => update("housingType", { housingType: h.value })}
              >
                {h.label}
              </ChoiceCard>
            ))}
          </div>
        )}
      </main>

      <StickyBottomAction>
        {step === 1 && province !== null && answers.region?.startsWith(province.name) && (
          <RegionSummary region={answers.region} label={answers.region.split(" ").at(-1) ?? answers.region} />
        )}
        <Button onClick={handleNext} disabled={!hasCurrentAnswer}>
          다음
        </Button>
      </StickyBottomAction>
    </AppShell>
  );
}
