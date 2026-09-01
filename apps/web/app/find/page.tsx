"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import bracketsJson from "@/data/income-brackets.json";
import policiesJson from "@/data/policies.json";
import WheelDatePicker from "@/app/WheelDatePicker";
import { AGE_MIN, POLICY_AGE_MAX, isAgeOutOfRange, resolveAnswers } from "@/lib/age";
import { birthYearOptions } from "@/lib/birth";
import { candidateCount, groupPolicies, splitByApplicationWindow } from "@/lib/discovery";
import { todayISO, fromISODate } from "@/lib/date";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  loadAnsweredKeys,
  saveAnswers,
  saveAnsweredKeys,
  type AnsweredKey,
} from "@/lib/storage";
import type { DiscoveryAnswers, DiscoveryStatus, IncomeBracket, PolicyMeta } from "@/lib/types";
import { REGION_OPTIONS } from "@/lib/region";
import {
  AnsweredStack,
  AppShell,
  Button,
  ChoiceCard,
  StepHeader,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { ICON_SM, TriangleAlert } from "@/app/components/icons";

/**
 * 1층 · 발견 — 질문 네 개를 한 번에 하나씩 묻는다.
 *
 * 예전에는 네 질문을 테두리 친 카드 넷으로 한 화면에 쌓았다. 답한 것과 안 한 것이
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

/** 질문 순서. 화면 제목의 줄바꿈은 의미 단위로 직접 끊는다 (StepHeader 주석 참고). */
const QUESTIONS = [
  { key: "birthDate", label: "생년월일", title: "생년월일이\n어떻게 되시나요?" },
  { key: "region", label: "사는 곳", title: "어디에 살거나\n살 예정인가요?" },
  { key: "status", label: "현재 상태", title: "현재 상태가\n어떻게 되시나요?" },
  { key: "incomeBracket", label: "월 소득", title: "본인의 월 소득은\n어느 정도인가요?" },
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
  /**
   * 실제로 답한 질문. 값의 null 만으로는 '모름'과 '아직 안 물어봄'을 가를 수 없다
   * (lib/storage.ts 의 loadAnsweredKeys 주석 참고).
   */
  const [answered, setAnswered] = useState<AnsweredKey[]>([]);

  // 서버 렌더링 후 브라우저에서 저장된 답변을 불러온다.
  useEffect(() => {
    const saved = loadAnswers();
    const savedKeys = loadAnsweredKeys();
    setAnswers(saved);
    setAnswered(savedKeys);
    setAsOf(todayISO());

    // 답을 다 한 사람은 마지막 단계로 보낸다. 거기 네 줄이 전부 쌓여 있어서 그
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
  // 접수가 끝난 정책도 후보에 들어간다. 목록 화면과 같은 기준으로 갈라 센다.
  const 신청가능수 = asOf ? splitByApplicationWindow(groups, asOf).신청가능.length : 0;

  // 답한 질문의 값이 null 이면 사용자가 '모름'을 고른 것이다. 요약에도 그렇게 적는다.
  const 답변줄 = [
    birthDateLabel(answers.birthDate, resolved.age),
    regionLabel(answers.region),
    answers.status,
    bracketLabel(answers.incomeBracket),
  ];

  /** 지금 질문보다 앞선 것 중 답한 것만, 가장 최근에 답한 것이 위로 오게 쌓는다. */
  const 쌓인답 = QUESTIONS.slice(0, step)
    .map((q, i) => ({
      label: q.label,
      value: answered.includes(q.key) ? (답변줄[i] ?? "모름") : null,
      onEdit: () => setStep(i),
    }))
    .reverse();

  const isLast = step === QUESTIONS.length - 1;

  function handleBack() {
    if (step === 0) return router.push("/");
    setStep(step - 1);
  }

  function handleNext() {
    // 마지막 답을 하면 결과 요약으로. 목록은 그 다음이다.
    if (isLast) return router.push("/find/result");
    setStep(step + 1);
  }

  // 답할수록 숫자가 좁혀지는 게 보여야 계속 답할 이유가 된다. 마지막 단계에서는
  // 목록으로 넘어가는 문구가 되고, 후보가 없으면 왜 없는지 보러 가게 한다.
  const ctaLabel = isLast
    ? 신청가능수 > 0
      ? `지원금 ${신청가능수}건 보기`
      : count > 0
        ? "왜 지금은 신청할 수 없는지 보기"
        : "왜 해당되지 않는지 보기"
    : 신청가능수 > 0
      ? `지원금 ${신청가능수}건 · 다음`
      : "다음";

  if (!loaded) {
    return (
      <AppShell>
        <TopBar onBack={() => router.push("/")} backLabel="이전 단계로" />
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </AppShell>
    );
  }

  const current = QUESTIONS[step];

  return (
    <AppShell>
      <TopBar onBack={handleBack} backLabel="이전 단계로" />

      {/* pb-28 은 하단 고정 CTA 높이만큼. 없으면 마지막으로 쌓인 답이 CTA 뒤에 깔린다. */}
      <main key={step} className="step-in flex flex-1 flex-col gap-7 pb-8 pt-7">
        <StepHeader title={current.title} />

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
              지금 담고 있는 정책은 만 {AGE_MIN}~{POLICY_AGE_MAX}세를 대상으로 합니다.
            </p>
            {isAgeOutOfRange(resolved.age) && (
              /* 색만으로 말하지 않는다 — 주황 면 위에 경고 아이콘을 함께 둔다. */
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
            {REGION_OPTIONS.map((r) => (
              <ChoiceCard
                key={r.value}
                active={answers.region === r.value}
                onClick={() => update("region", { region: r.value })}
              >
                {r.label}
              </ChoiceCard>
            ))}
            <ChoiceCard
              active={answered.includes("region") && answers.region === null}
              onClick={() => update("region", { region: null })}
            >
              모름
            </ChoiceCard>
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
            <ChoiceCard
              active={answered.includes("status") && answers.status === null}
              onClick={() => update("status", { status: null })}
            >
              모름
            </ChoiceCard>
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
            <ChoiceCard
              active={answered.includes("incomeBracket") && answers.incomeBracket === null}
              onClick={() => update("incomeBracket", { incomeBracket: null })}
            >
              모름
            </ChoiceCard>
          </div>
        )}

        <AnsweredStack items={쌓인답} />
      </main>

      <StickyBottomAction>
        <Button onClick={handleNext}>{ctaLabel}</Button>
      </StickyBottomAction>
    </AppShell>
  );
}
