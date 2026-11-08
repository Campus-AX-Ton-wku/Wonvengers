import type {
  DeclaredValue,
  DiscoveryAnswers,
  EligibilityProfile,
  ListingInput,
  RequiredInputKey,
} from "./types";
import {
  DISCOVERY_KEYS,
  ELIGIBILITY_KEYS,
  emptyContent,
  sanitizeContent,
  type ChecklistState,
  type UserDataContent,
} from "./user-data";

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

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 값을 적고, 실제로 바뀌었는지 돌려준다. 같은 값이면 적지도 알리지도 않는다 —
 * /find 마운트처럼 같은 값을 다시 적는 화면이 있어서, 알리면 로그인 상태에서 쓸데없는 PUT 이 생긴다.
 */
function writeJSON(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  const next = JSON.stringify(value);
  if (readRaw(key) === next) return false;
  window.localStorage.setItem(key, next);
  return true;
}

/** writeJSON 과 같지만 저장이 막혀도 던지지 않는다(시크릿 모드 등). 바뀌었는지(적으려 했는지) 돌려준다. */
function writeJSONSafely(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  const next = JSON.stringify(value);
  if (readRaw(key) === next) return false;
  try {
    window.localStorage.setItem(key, next);
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 한다.
  }
  return true;
}

export function saveListing(listing: ListingInput): void {
  if (writeJSON(LISTING_KEY, listing)) notifyLocalChange();
}

export function loadListing(): ListingInput | null {
  return readJSON<ListingInput>(LISTING_KEY);
}

export function saveProfile(profile: EligibilityProfile): void {
  if (writeJSON(PROFILE_KEY, profile)) notifyLocalChange();
}

export function loadProfile(): EligibilityProfile | null {
  const profile = readJSON<EligibilityProfile>(PROFILE_KEY);
  if (!profile) return null;
  // 직접 신고한 값은 별도 키가 단독 출처다. 프로필 안에 남아 있던 옛 값이 있어도
  // 덮어쓴다 — /eligibility 가 프로필을 통째로 저장하므로 두 벌을 두면 어긋난다.
  return { ...profile, selfDeclared: loadDeclared() };
}

// ── 2층에서 '직접 고른 질문' 기록 ──

const ELIGIBILITY_ANSWERED_KEY = "perky.eligibility-answered";

/**
 * /eligibility 에서 사용자가 직접 고른 질문. 1층의 loadAnsweredKeys 와 같은 방식이다.
 *
 * 2층은 손대지 않은 질문도 판정상 'unknown'(모름)이라, 값만 보고는 "모름을 골랐다" 와
 * "아직 안 골랐다" 를 가를 수 없다. 화면이 모름 카드를 칠할지 정하려면 이 기록이 따로 필요하다.
 * 프로필에 넣지 않는 이유: 판정에 쓰이지 않는 화면 상태다.
 *
 * 기록이 아예 없으면(이 키가 생기기 전에 저장된 프로필) null 을 준다 — 빈 목록과 구분해야
 * 화면이 옛 프로필의 값으로 기록을 대신 만들 수 있다.
 */
export function loadEligibilityAnsweredKeys(): RequiredInputKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ELIGIBILITY_ANSWERED_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed.filter((k) => typeof k === "string") as RequiredInputKey[])
      : null;
  } catch {
    return null;
  }
}

export function saveEligibilityAnsweredKeys(keys: readonly RequiredInputKey[]): void {
  if (writeJSONSafely(ELIGIBILITY_ANSWERED_KEY, keys)) notifyLocalChange();
}

// ── 결과 화면에서 직접 답한 '확인 필요' 조건 ──

/**
 * 판정 질문(/eligibility)이 받지 않는 조건의 답. check.key 로 찾는다.
 *
 * 프로필과 키를 나눈 이유: /eligibility 는 스텝마다 프로필을 통째로 다시 저장한다.
 * 같은 객체에 넣으면 판정 질문을 한 번 더 훑는 것만으로 결과 화면에서 답한 값이
 * 날아간다.
 */
const DECLARED_KEY = "perky.declared";

export function loadDeclared(): Record<string, DeclaredValue> {
  return readJSON<Record<string, DeclaredValue>>(DECLARED_KEY) ?? {};
}

/** 한 조건의 답을 저장한다. undefined 를 주면 '아직 모름'으로 되돌린다. */
export function saveDeclared(key: string, value: DeclaredValue | undefined): void {
  const next = loadDeclared();
  if (value === undefined || value === "") delete next[key];
  else next[key] = value;
  if (writeJSON(DECLARED_KEY, next)) notifyLocalChange();
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
 * 현재 Find는 모름을 허용하지 않아 null이 곧 미응답이다. 별도 기록은 과거 저장값을
 * 마이그레이션하고, 완료한 질문만 답변 요약에 쌓기 위해 유지한다. Find 진입 시 null인
 * 답의 키는 이 목록에서도 제거한다.
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
  if (writeJSONSafely(ANSWERED_KEY, keys)) notifyLocalChange();
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

/**
 * 답변을 브라우저에 저장한다. 로그인 전에는 여기서 끝이다 — 서버로 보내지 않는다.
 * 카카오로 로그인하고 저장에 동의한 이용자만 lib/sync.ts 가 이 알림을 듣고 서버에 올린다
 * (PRD F0-13 개정, docs/기획/2026-11-04-카카오-로그인-설계.md "동기화 규칙").
 */
export function saveAnswers(answers: DiscoveryAnswers): void {
  if (writeJSONSafely(ANSWERS_KEY, answers)) notifyLocalChange();
}

// ── 신청 체크리스트 (app/find/policies/[id]/prepare) ──

const CHECKLIST_PREFIX = "perky.application-checklist:";

export const EMPTY_CHECKLIST: ChecklistState = { eligibility: false, period: false, documents: false };

export function loadChecklist(policyId: string): ChecklistState {
  if (typeof window === "undefined") return EMPTY_CHECKLIST;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(`${CHECKLIST_PREFIX}${policyId}`) ?? "null"
    ) as Partial<ChecklistState> | null;
    return {
      eligibility: saved?.eligibility === true,
      period: saved?.period === true,
      documents: saved?.documents === true,
    };
  } catch {
    return EMPTY_CHECKLIST;
  }
}

export function saveChecklist(policyId: string, checklist: ChecklistState): void {
  // 저장이 제한된 환경에서도 체크와 외부 이동은 계속 쓸 수 있어야 한다(writeJSONSafely 는 던지지 않는다).
  if (writeJSONSafely(`${CHECKLIST_PREFIX}${policyId}`, checklist)) notifyLocalChange();
}

function checklistIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CHECKLIST_PREFIX)) ids.push(key.slice(CHECKLIST_PREFIX.length));
    }
  } catch {
    // 읽기가 막혀 있으면 체크리스트는 없는 것으로 본다.
  }
  return ids;
}

// ── 바뀜 알림 ──

/**
 * save* 가 부를 때마다 듣는 쪽(lib/sync.ts)에 알린다. 듣는 쪽은 로그인 + 동의일 때만 붙는다 —
 * 그 전에는 아무도 듣지 않으므로 서버 호출이 생길 수 없다.
 *
 * 서버 값으로 사본을 덮어쓸 때(writeLocalContent)와 로그아웃으로 비울 때(clearLocalContent)는
 * 알리지 않는다. 알리면 방금 받은 값을 다시 올린다.
 */
export interface LocalChange {
  /** true 면 1.5초 모으지 않고 바로 올린다('처음부터 다시'). */
  immediate: boolean;
}

const localListeners = new Set<(change: LocalChange) => void>();
let muted = 0;

export function onLocalChange(listener: (change: LocalChange) => void): () => void {
  localListeners.add(listener);
  return () => {
    localListeners.delete(listener);
  };
}

function notifyLocalChange(immediate = false): void {
  if (muted > 0) return;
  for (const listener of localListeners) listener({ immediate });
}

function quietly(write: () => void): void {
  muted++;
  try {
    write();
  } finally {
    muted--;
  }
}

// ── 사본 묶음 — lib/sync.ts 가 이 묶음으로 서버와 주고받는다 (lib/user-data.ts) ──

const SYNCED_KEYS = [ANSWERS_KEY, ANSWERED_KEY, LISTING_KEY, PROFILE_KEY, ELIGIBILITY_ANSWERED_KEY, DECLARED_KEY];

/** 이 기기의 답 일곱 갈래를 서버 형식으로 모은다. 깨진 묶음은 그 묶음만 버린다. */
export function readLocalContent(): UserDataContent {
  if (typeof window === "undefined") return emptyContent();
  const discovery = DISCOVERY_KEYS as readonly string[];
  const eligibility = ELIGIBILITY_KEYS as readonly string[];
  const profile = readJSON<Record<string, unknown>>(PROFILE_KEY);
  const eligibilityKeys = loadEligibilityAnsweredKeys();
  const declared = readJSON<Record<string, unknown>>(DECLARED_KEY);
  return sanitizeContent({
    answers: {
      values: loadAnswers(),
      answeredKeys: [...new Set(loadAnsweredKeys())].filter((k) => discovery.includes(k)),
    },
    listing: readJSON<unknown>(LISTING_KEY),
    profile:
      profile === null
        ? null
        : {
            // 직접 답한 조건은 perky.declared 가 단독 출처다(loadProfile 주석). 프로필 쪽 옛 값은 뺀다.
            values: Object.fromEntries(Object.entries(profile).filter(([k]) => k !== "selfDeclared")),
            answeredKeys:
              eligibilityKeys === null ? null : [...new Set(eligibilityKeys)].filter((k) => eligibility.includes(k)),
          },
    declared,
    checklists: Object.fromEntries(checklistIds().map((id) => [id, loadChecklist(id)])),
  });
}

/** 이 기기의 답을 모두 지운다. 로그인·동의·온보딩·가입 시트 기록은 답이 아니라서 남긴다. */
export function clearLocalContent(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of SYNCED_KEYS) window.localStorage.removeItem(key);
    for (const id of checklistIds()) window.localStorage.removeItem(`${CHECKLIST_PREFIX}${id}`);
  } catch {
    // 지우기가 막혀 있으면 할 수 있는 것이 없다.
  }
}

/** 서버 값으로 사본을 통째로 바꾼다. 알리지 않는다. */
export function writeLocalContent(content: UserDataContent): void {
  if (typeof window === "undefined") return;
  quietly(() => {
    clearLocalContent();
    const { values, answeredKeys } = content.answers;
    if (Object.values(values).some((v) => v !== null)) saveAnswers(values);
    if (answeredKeys.length > 0) saveAnsweredKeys(answeredKeys);
    if (content.listing) saveListing(content.listing);
    if (content.profile) {
      saveProfile(content.profile.values);
      if (content.profile.answeredKeys) saveEligibilityAnsweredKeys(content.profile.answeredKeys);
    }
    if (content.declared) writeJSON(DECLARED_KEY, content.declared);
    for (const [id, checklist] of Object.entries(content.checklists)) saveChecklist(id, checklist);
  });
}

/**
 * '처음부터 다시'. 1층 답, 2층 계약 조건·자격 답, 신청 체크리스트(첫 항목이 "자격 조건 확인"이라
 * 답이 바뀌면 예전 체크가 맞지 않는다), perky.declared 를 지운다. 로그인 상태·가입 시트 닫음 기록은 남긴다.
 * 로그인 상태면 lib/sync.ts 가 비운 데이터를 기다리지 않고 바로 올린다 — 다른 기기에서도 빈 상태.
 */
export function resetAllAnswers(): void {
  quietly(clearLocalContent);
  notifyLocalChange(true);
}

// ── 가입 제안 시트 (app/find/result/SignupSheet.tsx) ──

/** 닫으면 그 기기에서는 다시 띄우지 않는다. '처음부터 다시'·로그아웃으로도 지우지 않는다(답이 아니다). */
export const SIGNUP_DISMISSED_KEY = "perky.signup-dismissed";

export function hasDismissedSignup(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SIGNUP_DISMISSED_KEY) === "1";
  } catch {
    // 읽기가 막혀 있으면 닫은 것으로 본다. 매번 시트에 막히는 것보다 낫다.
    return true;
  }
}

export function dismissSignup(): void {
  try {
    window.localStorage.setItem(SIGNUP_DISMISSED_KEY, "1");
  } catch {
    // 못 적으면 다음에 한 번 더 보인다.
  }
}
