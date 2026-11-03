"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import policiesData from "@/data/policies.json";
import type { EligibilityProfile, PolicyMeta, RequiredInputKey } from "@/lib/types";
import { getRequiredQuestions, type QuestionDef } from "@/lib/questions";
import { birthYearOptions } from "@/lib/birth";
import { formatDotDate } from "@/lib/date";
import { formatKoreanMoney } from "@/lib/money";
import { replaceKeepingEntry, stepHref, useStepParam } from "@/lib/navigation";
import WheelDatePicker from "@/app/WheelDatePicker";

import { buildQuestionSteps } from "@/lib/steps";
import { policiesForRegion } from "@/lib/region";
import { loadAnswers, loadListing, loadProfile, saveAnswers, saveProfile } from "@/lib/storage";
import {
  AnswerSummaryBar,
  AppShell,
  Button,
  ChoiceCard,
  FieldError,
  MoneyInput,
  NumberInput,
  StepHeader,
  StickyBottomAction,
  TopBar,
} from "@/app/components";
import { ICON_SM, Pencil } from "@/app/components/icons";

/**
 * 2층 · 판정 질문. 주제별 묶음(lib/steps.ts) 하나가 한 화면이고, 묶음은 주소(?g=)에 있다.
 *
 * 한 화면에 질문이 4~6개라 1층과 달리 진행 표시("2/3 가구 · 소득")를 둔다. 답한 질문은
 * 한 줄로 접고 다음 질문을 화면 안으로 데려온다 — 아래로 내려가며 답하다 보면 위에서 고른
 * 것이 안 보인다는 2026-10-23 멘토링 지적 (docs/기획/2026-11-03-단계-이동-설계.md).
 */

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

type QuestionStep = ReturnType<typeof buildQuestionSteps>[number];

const BIRTH_REQUIRED = "생년월일을 입력해주세요.";

/**
 * 넘어가기 전에 막는 질문. 생년월일만 '모름' 이 없다 — 나이 요건 때문이다.
 * 나머지는 비워 두면 모름이고, 모름도 답이다.
 */
function blockingQuestion(group: QuestionStep, profile: EligibilityProfile): QuestionDef | null {
  return group.questions.find((q) => q.key === "birthDate" && !profile.birthDate) ?? null;
}

/**
 * 고르면 끝나는 질문만 접는다(예/아니오/모름, 날짜 '확인').
 * 숫자 칸은 언제 다 쳤는지 알 수 없고, 칸을 떠날 때 접으면 다음 칸을 누르려던 손가락
 * 밑에서 화면이 움직인다. 목록(select)은 키보드 화살표 하나에도 change 가 나서 접지 않는다.
 */
const FOLDS_ON_ANSWER: ReadonlySet<QuestionDef["type"]> = new Set(["boolean", "date"]);

/* globals.css 의 prefers-reduced-motion 규칙은 CSS 애니메이션만 끈다. scrollIntoView 의
   behavior 는 별개라 여기서 직접 물어본다 (WheelDatePicker 와 같은 방법). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function scrollToField(el: HTMLElement | undefined): void {
  // jsdom 에는 scrollIntoView 가 없다 — 테스트가 대역을 단다.
  el?.scrollIntoView?.({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** 접힌 줄에 쓰는 답. 선택지 문구와 같은 말을 쓴다. */
function answerText(question: QuestionDef, value: unknown): string {
  if (value === "unknown" || value === "" || value === undefined) return "모름";
  if (question.type === "boolean") return value === true ? "그렇다" : "아니다";
  if (question.type === "date" && typeof value === "string") return formatDotDate(value);
  if (question.type === "number" && typeof value === "number") {
    return question.money ? formatKoreanMoney(value) : String(value);
  }
  if (question.type === "select") {
    return question.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  return String(value);
}

/** useSearchParams 를 쓰므로 정적 export 에서 본문을 Suspense 안에 둔다. */
export default function EligibilityPage() {
  return (
    <Suspense fallback={<EligibilityLoading />}>
      <EligibilitySteps />
    </Suspense>
  );
}

function EligibilityLoading() {
  return (
    <AppShell>
      <TopBar backHref="/calculate" />
      <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
    </AppShell>
  );
}

function EligibilitySteps() {
  const router = useRouter();
  const [region, setRegion] = useState<string | null>(null);
  const [profile, setProfile] = useState<EligibilityProfile>(DEFAULT_PROFILE);
  const [error, setError] = useState<string | null>(null);
  /** 이번 방문에서 답해서 한 줄로 접힌 질문. 누르면 다시 펼친다. */
  const [folded, setFolded] = useState<ReadonlySet<RequiredInputKey>>(() => new Set());
  /** 방금 접은 질문과 화면 안으로 데려올 다음 질문. 렌더가 끝난 뒤 다뤄야 해서 상태로 둔다. */
  const [afterFold, setAfterFold] = useState<{
    folded: RequiredInputKey;
    next: RequiredInputKey | null;
  } | null>(null);
  const fieldRefs = useRef(new Map<RequiredInputKey, HTMLDivElement>());
  const titleRefs = useRef(new Map<RequiredInputKey, HTMLLabelElement>());

  useEffect(() => {
    const listing = loadListing();
    if (!listing) {
      // 계약 조건 없이는 판정할 수 없다. 홈이 아니라 그 입력을 받는 화면으로 보낸다.
      // replace 라 이 화면이 이 탭의 첫 화면이었다면 그 기록도 /calculate 로 옮긴다.
      replaceKeepingEntry(router, "/calculate");
      return;
    }
    setRegion(listing.region);

    // 생년월일은 1층과 2층이 나눠 갖는 값이 아니라 하나다. 1층 답을 소스 오브
    // 트루스로 삼아 여기서는 다시 묻지 않고 채워 둔다 — 고치는 건 그대로 된다
    // (아래 저장 effect 가 고친 값을 1층 답변에도 써서 둘을 붙여 둔다).
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

  /** 묶음 주소 값(?g=). 질문이 없는 묶음은 빠지므로 지역에 따라 1~3 개다. */
  const groupKeys = useMemo(() => steps.map((_, i) => String(i + 1)), [steps]);
  const { step: stepKey, go } = useStepParam("g", groupKeys, {
    ready: steps.length > 0,
    firstUnanswered: "1",
    // 앞 묶음의 생년월일 없이 ?g=3 으로 바로 들어오면 첫 묶음으로 돌린다.
    isReachable: (k) =>
      steps.slice(0, Number(k) - 1).every((s) => blockingQuestion(s, profile) === null),
  });
  const step = Math.max(0, Number(stepKey) - 1);

  // 뒤로가기로 묶음이 바뀌면 떠난 묶음의 오류 문구를 남기지 않는다.
  useEffect(() => setError(null), [stepKey]);

  useEffect(() => {
    if (afterFold === null) return;
    // 누른 선택지가 접힌 줄로 바뀌며 사라졌다. 포커스를 그 줄로 옮긴다 — 안 옮기면 body 로
    // 떨어져 키보드·스크린리더 사용자가 자리를 잃는다. 화면은 다음 질문 쪽으로 옮긴다.
    fieldRefs.current.get(afterFold.folded)?.querySelector("button")?.focus({ preventScroll: true });
    if (afterFold.next) scrollToField(fieldRefs.current.get(afterFold.next));
    setAfterFold(null);
  }, [afterFold]);

  /** 방금 펼친 질문. 누른 접힌 줄이 사라지므로 렌더 뒤 그 질문 제목으로 포커스를 옮긴다. */
  const [unfolded, setUnfolded] = useState<RequiredInputKey | null>(null);
  useEffect(() => {
    if (unfolded === null) return;
    titleRefs.current.get(unfolded)?.focus({ preventScroll: true });
    setUnfolded(null);
  }, [unfolded]);

  // 답할 때마다 저장한다. "다음" 에서만 저장하면 첫 묶음에서 화살표로 /calculate 에 돌아갔을 때
  // (뒤로가기라 "다음" 을 안 거친다) 그 묶음의 답이 사라진다. 불러오기 전(region === null)의
  // 빈 프로필로 저장된 답을 덮지 않는다.
  useEffect(() => {
    if (region === null) return;
    saveProfile(profile);

    // 여기서 고친 생년월일을 1층 답변에도 써 둔다. 1층 답을 프리필의 기준으로
    // 삼았으므로, 안 써 두면 다음에 이 화면에 들어올 때 1층의 옛 값이 다시 이겨서
    // 방금 한 수정이 사라진다. 두 화면이 같은 값을 보게 붙여 두는 것이다.
    if (profile.birthDate) {
      const answers = loadAnswers();
      if (answers.birthDate !== profile.birthDate) {
        saveAnswers({ ...answers, birthDate: profile.birthDate });
      }
    }
  }, [region, profile]);

  function update<K extends keyof EligibilityProfile>(key: K, value: EligibilityProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function answer(question: QuestionDef, value: unknown, questions: QuestionDef[]) {
    update(question.key, value as never);
    if (!FOLDS_ON_ANSWER.has(question.type)) return;
    const next = new Set(folded).add(question.key);
    setFolded(next);
    const after = questions.slice(questions.indexOf(question) + 1).find((q) => !next.has(q.key));
    setAfterFold({ folded: question.key, next: after?.key ?? null });
  }

  function unfold(key: RequiredInputKey) {
    const next = new Set(folded);
    next.delete(key);
    setFolded(next);
    setUnfolded(key);
  }

  function handleNext() {
    const current = steps[step];
    const blocking = current ? blockingQuestion(current, profile) : null;
    if (blocking) {
      // 아래 한 줄 오류만으로는 긴 묶음에서 어느 질문인지 찾아 올라가야 한다.
      // 그 질문으로 데려가고 제목에 포커스해 스크린리더도 그 질문부터 읽게 한다.
      setError(BIRTH_REQUIRED);
      scrollToField(fieldRefs.current.get(blocking.key));
      titleRefs.current.get(blocking.key)?.focus({ preventScroll: true });
      return;
    }
    setError(null);
    if (step < steps.length - 1) return go(String(step + 2));
    router.push("/result");
  }

  if (region === null || steps.length === 0) return <EligibilityLoading />;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  /** 앞 묶음은 이름만 남긴다. 누르면 그 묶음 주소로 간다. */
  const summary = steps.slice(0, step).map((s, i) => ({
    key: `g${i + 1}`,
    label: `${i + 1}단계`,
    value: s.title,
    href: stepHref("/eligibility", "g", String(i + 1)),
  }));

  return (
    <AppShell>
      <TopBar backHref="/calculate" />
      <AnswerSummaryBar
        lead={
          <span className="inline-flex min-h-11 items-center text-sm font-bold text-brand-800">
            {`${step + 1}/${steps.length} ${current.title}`}
          </span>
        }
        items={summary}
      />

      <main key={stepKey} className="step-in flex flex-1 flex-col gap-8 py-7">
        <StepHeader title={current.heading} />

        {current.questions.map((q) => (
          <QuestionField
            key={q.key}
            question={q}
            value={profile[q.key]}
            folded={folded.has(q.key)}
            onChange={(v) => answer(q, v, current.questions)}
            onUnfold={() => unfold(q.key)}
            fieldRef={(el) => {
              if (el) fieldRefs.current.set(q.key, el);
              else fieldRefs.current.delete(q.key);
            }}
            titleRef={(el) => {
              if (el) titleRefs.current.set(q.key, el);
              else titleRefs.current.delete(q.key);
            }}
          />
        ))}

        {error && <FieldError>{error}</FieldError>}
      </main>

      <StickyBottomAction>
        <Button onClick={handleNext}>{isLast ? "결과 확인하기" : "다음"}</Button>
      </StickyBottomAction>
    </AppShell>
  );
}

function QuestionField({
  question,
  value,
  folded,
  onChange,
  onUnfold,
  fieldRef,
  titleRef,
}: {
  question: QuestionDef;
  value: unknown;
  folded: boolean;
  onChange: (value: unknown) => void;
  onUnfold: () => void;
  fieldRef: (el: HTMLDivElement | null) => void;
  titleRef: (el: HTMLLabelElement | null) => void;
}) {
  const isUnknown = value === "unknown";
  // 라벨을 for/id 로 묶는다. 묶이지 않으면 스크린리더가 입력칸을 이름 없이 읽고,
  // 라벨을 눌러도 칸에 포커스가 가지 않는다.
  const inputId = `q-${question.key}`;

  if (folded) {
    const text = answerText(question, value);
    return (
      <div ref={fieldRef}>
        <button
          type="button"
          onClick={onUnfold}
          aria-label={`${question.shortLabel} 고치기: ${text}`}
          className="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-2.5 text-left shadow-card transition-colors hover:bg-brand-50"
        >
          <span className="min-w-0 truncate text-sm">
            <span className="font-semibold text-ink-500">{question.shortLabel}</span>
            <span aria-hidden="true" className="px-1.5 text-ink-300">
              ·
            </span>
            <span className="font-bold text-ink-900">{text}</span>
          </span>
          <Pencil size={ICON_SM} aria-hidden="true" className="shrink-0 text-ink-300" />
        </button>
      </div>
    );
  }

  return (
    <div ref={fieldRef} className="flex flex-col gap-3">
      {/* tabIndex -1: 미답으로 "다음" 을 누르면 여기로 포커스를 옮긴다. 탭 순서에는 넣지 않는다. */}
      <label
        ref={titleRef}
        htmlFor={inputId}
        tabIndex={-1}
        className="rounded-control text-base font-bold leading-snug text-ink-900 focus-ring outline-none"
      >
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
          <ChoiceCard active={value === true} onClick={() => onChange(true)}>
            그렇다
          </ChoiceCard>
          <ChoiceCard active={value === false} onClick={() => onChange(false)}>
            아니다
          </ChoiceCard>
          {question.allowUnknown && (
            <ChoiceCard active={isUnknown} onClick={() => onChange("unknown")}>
              모름
            </ChoiceCard>
          )}
        </div>
      )}

      {/* 빈 칸 = 모름이다. 예전에는 '모름' 을 두 번 누르면 값이 0 이 됐고, 소득 0원은
          모든 소득 상한을 통과해 '예상 적용' 으로 잘못 판정됐다. 칸을 비활성화하지
          않으므로 숫자를 입력하면 모름이 자연스럽게 풀린다. */}
      {question.type === "number" && (
        <div className="flex flex-col gap-2">
          {/* 빈 칸 = 모름이다. MoneyInput 은 0 하나 더/덜 친 실수를 그 자리에서
              읽어준다 (F1-8). 금액이 아닌 숫자(가구원 수)는 환산이 없다. */}
          {question.money ? (
            <MoneyInput
              id={inputId}
              value={typeof value === "number" ? value : null}
              onChange={(won) => onChange(won === null ? "unknown" : won)}
            />
          ) : (
            <NumberInput
              id={inputId}
              value={typeof value === "number" ? value : null}
              onChange={(v) => onChange(v === null ? "unknown" : v)}
            />
          )}
          {question.allowUnknown && (
            <ChoiceCard active={isUnknown} onClick={() => onChange("unknown")}>
              모름
            </ChoiceCard>
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
