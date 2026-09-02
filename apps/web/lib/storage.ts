import type { DiscoveryAnswers, EligibilityProfile, ListingInput } from "./types";

const LISTING_KEY = "housing-benefit:listing";
const PROFILE_KEY = "housing-benefit:profile";

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function saveListing(listing: ListingInput): void {
  writeJSON(LISTING_KEY, listing);
}

export function loadListing(): ListingInput | null {
  return readJSON<ListingInput>(LISTING_KEY);
}

export function saveProfile(profile: EligibilityProfile): void {
  writeJSON(PROFILE_KEY, profile);
}

export function loadProfile(): EligibilityProfile | null {
  return readJSON<EligibilityProfile>(PROFILE_KEY);
}

// ── 1층(발견) 답변 ──

const ANSWERS_KEY = "perky.answers";

export const EMPTY_ANSWERS: DiscoveryAnswers = {
  birthDate: null,
  region: null,
  status: null,
  incomeBracket: null,
  housingType: null,
};

/**
 * 저장된 값에서 아는 항목만 골라 담는다.
 *
 * 그냥 펼치면(`{ ...EMPTY_ANSWERS, ...JSON.parse(raw) }`) 옛 스키마의 age 가 따라
 * 들어와 지워진 필드가 살아남는다. 나이는 생년월일로 바뀌었는데 생일을 모르니
 * age 로 생년월일을 지어낼 수 없다 — 1월 1일 같은 값을 만들면 그 거짓 날짜가
 * 2층 나이 요건 판정까지 그대로 쓰인다. 그래서 나이만 버리고 나머지 세 답은 살린다.
 */
function pickAnswers(saved: Record<string, unknown>): DiscoveryAnswers {
  return {
    birthDate: typeof saved.birthDate === "string" ? saved.birthDate : null,
    region: typeof saved.region === "string" ? saved.region : null,
    status: (saved.status as DiscoveryAnswers["status"]) ?? null,
    incomeBracket: typeof saved.incomeBracket === "number" ? saved.incomeBracket : null,
    housingType: (saved.housingType as DiscoveryAnswers["housingType"]) ?? null,
  };
}

/**
 * 저장된 1층 답변을 읽는다. 서버 렌더링 중에는 localStorage 가 없으므로 빈 답변을 준다.
 * 저장된 값이 깨져 있어도 화면이 죽지 않도록 오류를 삼킨다.
 */
export function loadAnswers(): DiscoveryAnswers {
  if (typeof window === "undefined") return EMPTY_ANSWERS;
  try {
    const raw = window.localStorage.getItem(ANSWERS_KEY);
    if (!raw) return EMPTY_ANSWERS;
    return pickAnswers(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return EMPTY_ANSWERS;
  }
}

// ── 1층에서 '답한 질문' 기록 ──

const ANSWERED_KEY = "perky.answered";

/** 1층 질문의 식별자. DiscoveryAnswers 의 키와 같다. */
export type AnsweredKey = keyof DiscoveryAnswers;

/**
 * 어떤 질문에 실제로 답했는지만 따로 기록한다.
 *
 * 답변 값의 null 은 '모름'과 '아직 안 물어봄'을 겸한다. 판정에는 둘 다 똑같이
 * '모름'이라 문제가 없지만, 화면에는 문제가 된다 — 아직 고르지도 않은 '모름'
 * 버튼이 선택된 것처럼 체크되고, 모름으로 답한 질문은 답변 요약에 나타나지
 * 않으며, 다시 들어오면 이미 답한 질문으로 되돌아간다.
 *
 * DiscoveryAnswers 에 넣지 않고 키를 나눈 이유: 이건 판정에 쓰이지 않는 화면
 * 상태다. 판정 코드(filter·discovery)가 이 값을 볼 일이 없어야 한다.
 */
export function loadAnsweredKeys(): AnsweredKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ANSWERED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((k) => typeof k === "string") as AnsweredKey[]) : [];
  } catch {
    return [];
  }
}

export function saveAnsweredKeys(keys: AnsweredKey[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANSWERED_KEY, JSON.stringify(keys));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 한다.
  }
}

// ── 온보딩 ──

/**
 * 온보딩을 보았는지. 완료·건너뛰기 둘 다 같은 값으로 기록한다 — 사용자에게는
 * "다시 보고 싶지 않다" 는 같은 뜻이고, 둘을 나눠 저장하면 재노출 규칙이 두 갈래가 된다.
 *
 * 이 키는 app/layout.tsx 의 인라인 스크립트도 읽는다. 리터럴이 그쪽에도 있으니
 * 값을 바꾸려면 두 곳을 함께 고칠 것 (layout 은 React 가 뜨기 전에 실행돼야 해서
 * 이 모듈을 import 할 수 없다).
 */
export const ONBOARDED_KEY = "perky.onboarded";

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    // 시크릿 모드 등에서 읽기가 막히면 '봤다'로 친다. 매번 온보딩에 갇히는 것보다 낫다.
    return true;
  }
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // 저장이 막혀도 앱은 계속 동작해야 한다.
  }
}

/** 개발·QA 용. 다음 방문에 온보딩을 다시 보게 한다. */
export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // 무시
  }
}

/** 답변을 브라우저에만 저장한다. 서버로 보내지 않는다. (PRD F0-13) */
export function saveAnswers(answers: DiscoveryAnswers): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 한다.
  }
}
