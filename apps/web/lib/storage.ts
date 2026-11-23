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
  ledgerForSync,
  readBadges,
  readProfileCard,
  sanitizeContent,
  type BadgeId,
  type ProfileCardData,
  type ChecklistState,
  type UserDataContent,
} from "./user-data";
import { isSaved, toggleSaved } from "./saved";
import { emptyLedger, parseLedger, type LedgerRecord } from "./ledger";
import { parseHouseChecklist } from "./house-checklist";
import { GUIDES } from "./guides";

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
  // 전세 칸은 전세 계약에만 남긴다 — 예전 서버(11/23 전)는 모르는 키를 거부해서, 월세로 바꾼 뒤에도
  // 칸이 남아 있으면 월세 저장까지 서버에 못 올라간다. 전세면 월세 · 연세 금액은 쓰지 않으니 0 으로 둔다.
  const { jeonseLoanAmount, jeonseLoanRate, ...rest } = listing;
  const tidy: ListingInput =
    listing.contractType === "전세"
      ? {
          ...rest,
          rentOrYearlyAmount: 0,
          ...(jeonseLoanAmount !== undefined && { jeonseLoanAmount }),
          ...(jeonseLoanRate !== undefined && { jeonseLoanRate }),
        }
      : rest;
  if (writeJSON(LISTING_KEY, tidy)) notifyLocalChange();
}

export function loadListing(): ListingInput | null {
  const listing = readJSON<ListingInput>(LISTING_KEY);
  if (!listing) return null;
  // 이사비·중개보수는 11/21 부터 묻지 않는다. 예전에 넣어 둔 값이 남아 있으면 고칠 칸도 없이
  // 영수증 '이사비' 줄과 이사비 지원 합계에 계속 들어간다 — 읽을 때 0 으로 둔다.
  return { ...listing, oneTimeMoveCost: 0 };
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

// ── 사용자가 직접 답한 '확인 필요' 조건 (예전 결과 화면 질문의 답 — 11/18 화면은 지웠고, 값은 판정 · 동기화에 그대로 쓴다) ──

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

// ── 찜 · 서류 체크 (11/17, docs/기획/2026-11-17-홈-찜하기-설계.md) ──
const SAVED_KEY = "perky.saved";
const DOCUMENT_CHECKS_PREFIX = "perky.document-checks:";

export function loadSaved(): string[] {
  const v = readJSON<unknown>(SAVED_KEY);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function saveSavedList(ids: readonly string[]): void {
  if (writeJSONSafely(SAVED_KEY, ids)) notifyLocalChange();
}

/** 찜 ↔ 해제. 바뀐 뒤 찜 상태를 돌려준다. */
export function toggleSavedPolicy(id: string): boolean {
  const next = toggleSaved(loadSaved(), id);
  saveSavedList(next);
  return isSaved(next, id);
}

export function loadDocumentChecks(policyId: string): string[] {
  const v = readJSON<unknown>(`${DOCUMENT_CHECKS_PREFIX}${policyId}`);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function saveDocumentChecks(policyId: string, names: readonly string[]): void {
  if (writeJSONSafely(`${DOCUMENT_CHECKS_PREFIX}${policyId}`, names)) notifyLocalChange();
}

// ── 내 프로필 · 배지 (11/22, docs/기획/2026-11-22-내-프로필-설계.md §1) — 계정과 동기화한다 ──
const PROFILE_CARD_KEY = "perky.profile-card";
const BADGES_KEY = "perky.badges";
/** 주거비 달력 · 집 보기 체크리스트 — 11/23 부터 계정에 저장(아래 각 절) */
const LEDGER_KEY = "perky.ledger";
export const HOUSE_CHECKLIST_KEY = "perky.house-checklist";

/** 꾸민 프로필. 안 꾸몄으면(또는 깨졌으면) null — 화면은 기본값(집 · 파랑 · 기본 이름)으로 그린다 */
export function loadProfileCard(): ProfileCardData | null {
  return readProfileCard(readJSON<unknown>(PROFILE_CARD_KEY));
}

export function saveProfileCard(card: ProfileCardData): void {
  if (writeJSONSafely(PROFILE_CARD_KEY, card)) notifyLocalChange();
}

/** 받은 배지 → 받은 날 */
export function loadBadges(): Partial<Record<BadgeId, string>> {
  return readBadges(readJSON<unknown>(BADGES_KEY));
}

export function saveBadges(badges: Partial<Record<BadgeId, string>>): void {
  if (writeJSONSafely(BADGES_KEY, badges)) notifyLocalChange();
}

function documentCheckIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(DOCUMENT_CHECKS_PREFIX)) ids.push(key.slice(DOCUMENT_CHECKS_PREFIX.length));
    }
  } catch {
    // 읽기가 막혀 있으면 없는 것으로 본다
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

const SYNCED_KEYS = [
  ANSWERS_KEY,
  ANSWERED_KEY,
  LISTING_KEY,
  PROFILE_KEY,
  ELIGIBILITY_ANSWERED_KEY,
  DECLARED_KEY,
  SAVED_KEY,
  PROFILE_CARD_KEY,
  BADGES_KEY,
  LEDGER_KEY,
  HOUSE_CHECKLIST_KEY,
];

/** 이 기기의 답 갈래들을 서버 형식으로 모은다. 깨진 묶음은 그 묶음만 버린다. */
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
    saved: readJSON<unknown>(SAVED_KEY) ?? [],
    documentChecks: Object.fromEntries(documentCheckIds().map((id) => [id, loadDocumentChecks(id)])),
    profileCard: readJSON<unknown>(PROFILE_CARD_KEY),
    badges: readJSON<unknown>(BADGES_KEY) ?? {},
    ledger: ledgerForSync(loadLedger()),
    houseChecklist: loadHouseChecklist(),
  });
}

/** 이 기기의 답을 모두 지운다. 로그인·동의·온보딩 기록은 답이 아니라서 남긴다. */
export function clearLocalContent(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of SYNCED_KEYS) window.localStorage.removeItem(key);
    for (const id of checklistIds()) window.localStorage.removeItem(`${CHECKLIST_PREFIX}${id}`);
    for (const id of documentCheckIds()) window.localStorage.removeItem(`${DOCUMENT_CHECKS_PREFIX}${id}`);
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
    if (content.saved.length > 0) writeJSON(SAVED_KEY, content.saved);
    for (const [id, names] of Object.entries(content.documentChecks)) writeJSON(`${DOCUMENT_CHECKS_PREFIX}${id}`, names);
    if (content.profileCard) writeJSON(PROFILE_CARD_KEY, content.profileCard);
    if (Object.keys(content.badges).length > 0) writeJSON(BADGES_KEY, content.badges);
    if (content.ledger) writeJSON(LEDGER_KEY, content.ledger);
    if (content.houseChecklist.length > 0) writeJSON(HOUSE_CHECKLIST_KEY, { v: 1, checked: content.houseChecklist });
  });
}

/**
 * '처음부터 다시'. 1층 답, 2층 계약 조건·자격 답, 신청 체크리스트(첫 항목이 "자격 조건 확인"이라
 * 답이 바뀌면 예전 체크가 맞지 않는다), perky.declared 를 지운다. 로그인 상태는 남긴다.
 * 로그인 상태면 lib/sync.ts 가 비운 데이터를 기다리지 않고 바로 올린다 — 다른 기기에서도 빈 상태.
 */
export function resetAllAnswers(): void {
  // 프로필 · 배지(11/22)는 답이 아니라서 남긴다 — 사본을 비우기 전에 읽어 두었다가 다시 쓴다
  const profileCard = loadProfileCard();
  const badges = loadBadges();
  quietly(() => {
    clearLocalContent();
    if (profileCard) writeJSON(PROFILE_CARD_KEY, profileCard);
    if (Object.keys(badges).length > 0) writeJSON(BADGES_KEY, badges);
  });
  clearDeviceRecords();
  notifyLocalChange(true);
}

// ── 주거비 달력 (docs/기획/2026-11-21-주거비-달력-설계.md §5) ──


/**
 * 주거비 달력 기록. 11/23 부터 **계정에 저장**한다(ggue) — SYNCED_KEYS · readLocalContent · writeLocalContent 에 있다.
 * 누를 때마다 notifyLocalChange — lib/sync.ts 가 1.5초 모았다가 한 번 올린다.
 * 지우는 곳: 로그아웃(이 기기 사본만, 서버에는 남는다) · 탈퇴 · '처음부터 다시'(서버도 비운다).
 */
export function loadLedger(): LedgerRecord {
  if (typeof window === "undefined") return emptyLedger();
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    return raw ? parseLedger(JSON.parse(raw)) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(record: LedgerRecord): void {
  if (writeJSONSafely(LEDGER_KEY, record)) {
    notifyLocalChange();
    notifyDeviceRecordChange();
  }
}

export function clearLedger(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    // 지우기가 막혀 있으면 할 수 있는 것이 없다.
  }
}

// ── 집 보러 갈 때 체크리스트 (docs/기획/2026-11-22-집-보기-체크리스트-설계.md) ──
// 이름이 HouseChecklist 인 까닭: 위의 loadChecklist · saveChecklist 는 신청 준비 체크(perky.application-checklist:*)다.


/** 체크한 줄. 주거비 달력과 같은 규칙 — 11/23 부터 계정에 저장, 바꿀 때마다 notifyLocalChange. */
export function loadHouseChecklist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HOUSE_CHECKLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseHouseChecklist(parsed && typeof parsed === "object" ? (parsed as { checked?: unknown }).checked : null);
  } catch {
    return [];
  }
}

/** [체크 모두 지우기]도 이것으로(빈 목록) — clearHouseChecklist 는 알리지 않아서 서버에 남는다. */
export function saveHouseChecklist(ids: string[]): void {
  if (writeJSONSafely(HOUSE_CHECKLIST_KEY, { v: 1, checked: ids })) notifyLocalChange();
}

export function clearHouseChecklist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HOUSE_CHECKLIST_KEY);
  } catch {
    // 지우기가 막혀 있으면 할 수 있는 것이 없다.
  }
}

/**
 * 이 기기 사본에서 지울 기록 — 주거비 달력 · 집 보기 체크리스트(11/23 부터 계정에도 있다) · 가이드 읽음 · 배지 처음 판정.
 * 로그아웃 · 탈퇴(lib/sync.ts) · '처음부터 다시'에서. 알리지 않는다(서버 값은 그대로).
 */
export function clearDeviceRecords(): void {
  clearLedger();
  clearHouseChecklist();
  removeQuietly(GUIDES_READ_KEY);
  removeQuietly(BADGES_SEEN_KEY);
  removeQuietly(HOME_REACHED_KEY);
  removeQuietly(PUSH_ASK_KEY);
}

function removeQuietly(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 지우기가 막혀 있으면 할 수 있는 것이 없다.
  }
}

// ── 배지 재료 기록의 알림 (11/22 배지) ──
// 가이드 읽음은 이 기기에만 있어 동기화 알림(onLocalChange)을 쓰지 않는다. 주거비 달력은 11/23 부터 둘 다 보낸다.
// 배지 판정(BadgeWatcher)이 다시 볼 수 있게 따로 알린다.
const DEVICE_RECORD_EVENT = "perky:device-record";

function notifyDeviceRecordChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DEVICE_RECORD_EVENT));
}

export function onDeviceRecordChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DEVICE_RECORD_EVENT, listener);
  return () => window.removeEventListener(DEVICE_RECORD_EVENT, listener);
}

// ── 가이드 읽음 · 배지 처음 판정 (docs/기획/2026-11-22-내-프로필-설계.md §7) — 이 기기에만 ──
const GUIDES_READ_KEY = "perky.guides-read";
const BADGES_SEEN_KEY = "perky.badges-seen";
const HOME_REACHED_KEY = "perky.home-reached";
const PUSH_ASK_KEY = "perky.push-ask";

/**
 * 알림 허용을 물어본 기록 (11/23 ggue) — 이 기기 · 계정마다. 판단은 lib/push-ask.ts.
 * lastAskedAt: 홈 · 알림함에서 마지막으로 물은 때(ISO). inboxAsked: 알림함 첫 방문에 물었는가.
 * 로그아웃 · '처음부터 다시'에 지운다(clearDeviceRecords) — 다시 로그인하고 홈에 오면 다시 묻는다.
 */
export interface PushAskRecord {
  lastAskedAt: string | null;
  inboxAsked: boolean;
}

export function loadPushAsk(sub: string): PushAskRecord {
  const v = readJSON<{ sub?: unknown; lastAskedAt?: unknown; inboxAsked?: unknown }>(PUSH_ASK_KEY);
  if (!v || v.sub !== sub) return { lastAskedAt: null, inboxAsked: false };
  return {
    lastAskedAt: typeof v.lastAskedAt === "string" ? v.lastAskedAt : null,
    inboxAsked: v.inboxAsked === true,
  };
}

export function savePushAsk(sub: string, record: PushAskRecord): void {
  writeJSONSafely(PUSH_ASK_KEY, { sub, ...record });
}

/** 끝 장까지 연 가이드 id. 모르는 id 는 버린다 */
export function loadGuidesRead(): string[] {
  const v = readJSON<unknown>(GUIDES_READ_KEY);
  if (!Array.isArray(v)) return [];
  const known = new Set(GUIDES.map((g) => g.id));
  return [...new Set(v.filter((x): x is string => typeof x === "string" && known.has(x)))];
}

export function markGuideRead(id: string): void {
  const read = loadGuidesRead();
  if (read.includes(id)) return;
  if (writeJSONSafely(GUIDES_READ_KEY, [...read, id])) notifyDeviceRecordChange();
}

/** 이 기기에서 배지를 한 번이라도 판정했는가 — 처음 판정은 창 없이 조용히 기록한다 */
export function badgesSeen(): boolean {
  return readRaw(BADGES_SEEN_KEY) === "1";
}

/**
 * 이 계정(sub)으로 로그인한 뒤 홈 화면에 들어왔는가 — 배지 판정 · 알림은 그 뒤부터 (11/23 ggue).
 * 앱을 처음 열고 질문 · 카카오 로그인 · 계산을 지나는 동안에는 배지 창이 뜨지 않는다. 홈은 로그인한 사람만 들어간다.
 * 계정마다 따로 — 다른 계정으로 들어오면 다시 홈을 기다린다. 로그아웃 · '처음부터 다시'에 지운다(clearDeviceRecords).
 */
export function homeReachedBy(sub: string | null): boolean {
  return sub !== null && readRaw(HOME_REACHED_KEY) === sub;
}

export function markHomeReached(sub: string): void {
  if (typeof window === "undefined" || homeReachedBy(sub)) return;
  try {
    window.localStorage.setItem(HOME_REACHED_KEY, sub);
  } catch {
    return; // 못 적으면 홈에 올 때마다 다시 적어 본다
  }
  notifyDeviceRecordChange();
}

export function markBadgesSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BADGES_SEEN_KEY, "1");
  } catch {
    // 못 적으면 다음에 또 조용히 판정할 뿐이다.
  }
}
