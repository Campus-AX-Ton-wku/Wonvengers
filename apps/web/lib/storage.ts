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

/** 답변을 브라우저에만 저장한다. 서버로 보내지 않는다. (PRD F0-13) */
export function saveAnswers(answers: DiscoveryAnswers): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 한다.
  }
}
