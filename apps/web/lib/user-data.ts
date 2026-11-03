import type {
  DeclaredValue,
  DiscoveryAnswers,
  DiscoveryStatus,
  EligibilityProfile,
  HousingType,
  ListingInput,
  RequiredInputKey,
} from "./types";

/**
 * 로그인한 이용자의 답을 서버에 저장하는 형식 — 웹(lib/storage.ts·lib/sync.ts)과
 * API(apps/api)가 함께 쓰는 단독 출처다 (docs/기획/2026-11-04-카카오-로그인-설계.md "데이터").
 *
 * API 는 이 파일을 상대 경로로 가져와 같은 규칙으로 다시 검사한다(신뢰 경계). 그래서 이 파일은
 * ./types 의 타입 말고는 아무것도 import 하지 않고, 브라우저 API 도 Node API 도 쓰지 않는다.
 *
 * 오류 문구에는 경로만 담고 값은 담지 않는다. API 가 400 응답과 로그에 그대로 쓴다.
 * 알 수 없는 키는 어느 깊이에서든 거부한다 — 본문에 userId 를 끼워 넣어도 통과하지 못한다.
 */

export const SCHEMA_VERSION = 1;
/** 동의 화면 문구의 버전. 문구를 바꾸면 날짜를 올리고, 서버는 옛 버전의 저장을 거절한다. */
export const CONSENT_VERSION = "2026-11-04";
/** PUT 본문 상한. 글자 수가 아니라 바이트다 — 한글은 한 글자에 3바이트. */
export const MAX_BODY_BYTES = 64 * 1024;

export type DiscoveryKey = keyof DiscoveryAnswers;
export type EligibilityValues = Omit<EligibilityProfile, "selfDeclared">;

/** 신청 준비 화면의 확인 세 칸 (app/find/policies/[id]/prepare). */
export interface ChecklistState {
  eligibility: boolean;
  period: boolean;
  documents: boolean;
}

/** 이 기기의 localStorage 키 일곱 갈래를 그대로 옮긴 묶음. */
export interface UserDataContent {
  /** perky.answers + perky.answered */
  answers: { values: DiscoveryAnswers; answeredKeys: DiscoveryKey[] };
  /** housing-benefit:listing */
  listing: ListingInput | null;
  /** housing-benefit:profile(selfDeclared 뺌) + perky.eligibility-answered */
  profile: { values: EligibilityValues; answeredKeys: RequiredInputKey[] | null } | null;
  /** perky.declared — 빈 객체는 null */
  declared: Record<string, DeclaredValue> | null;
  /** perky.application-checklist:<policyId> */
  checklists: Record<string, ChecklistState>;
}

export interface UserDataPayload extends UserDataContent {
  schemaVersion: typeof SCHEMA_VERSION;
  consentVersion: typeof CONSENT_VERSION;
  consentAt: string;
}

export interface PutRequestBody {
  data: UserDataPayload;
  /** 이 기기가 마지막으로 본 서버 시각. 서버 값과 다르면 409. 서버 항목이 없다고 믿으면 null. */
  baseUpdatedAt: string | null;
}

export interface GetResponseBody {
  data: UserDataPayload;
  updatedAt: string;
}

export interface PutResponseBody {
  updatedAt: string;
}

export const DISCOVERY_KEYS = [
  "birthDate",
  "region",
  "status",
  "incomeBracket",
  "housingType",
] as const satisfies readonly DiscoveryKey[];

const STATUSES = ["대학생", "재직", "구직"] as const satisfies readonly DiscoveryStatus[];
const HOUSING_TYPES = ["월세", "연세", "전세", "그 외"] as const satisfies readonly HousingType[];
const CONTRACT_TYPES = ["월세", "연세"] as const satisfies readonly ListingInput["contractType"][];
const WORK_STATUSES = [
  "student",
  "employed",
  "unemployed",
  "unknown",
] as const satisfies readonly EligibilityProfile["isStudentOrEmployed"][];

const LISTING_KEYS = [
  "region",
  "contractType",
  "deposit",
  "rentOrYearlyAmount",
  "managementFee",
  "oneTimeMoveCost",
  "contractStartDate",
  "months",
  "confirmedMatchesActualContract",
] as const satisfies readonly (keyof ListingInput)[];

const YES_NO_KEYS = [
  "livesApartFromParents",
  "canRegisterResidence",
  "hasNoHouse",
  "isContractHolder",
  "useOriginHousehold",
  "assetsUnder107M",
  "isBasicLivelihoodRecipient",
  "isNearPovertyClass",
  "receivingOtherRentSupport",
  "jeonbukResidentOverOneYear",
  "employedInTargetSectorOver3Months",
] as const satisfies readonly RequiredInputKey[];

const MONEY_KEYS = [
  "ownHouseholdMonthlyIncome",
  "originHouseholdMonthlyIncome",
] as const satisfies readonly RequiredInputKey[];

export const ELIGIBILITY_KEYS = [
  "birthDate",
  "isStudentOrEmployed",
  ...YES_NO_KEYS,
  "householdSize",
  ...MONEY_KEYS,
] as const satisfies readonly RequiredInputKey[];

// 타입에 항목이 늘었는데 여기를 안 고치면 컴파일이 깨진다 — 새 답이 검사에서 조용히 버려지지 않게.
const everyListingKey: [Exclude<keyof ListingInput, (typeof LISTING_KEYS)[number]>] extends [never]
  ? true
  : false = true;
const everyEligibilityKey: [Exclude<RequiredInputKey, (typeof ELIGIBILITY_KEYS)[number]>] extends [never]
  ? true
  : false = true;
void everyListingKey;
void everyEligibilityKey;

const PAYLOAD_KEYS = [
  "schemaVersion",
  "consentVersion",
  "consentAt",
  "answers",
  "listing",
  "profile",
  "declared",
  "checklists",
] as const;

const MAX_DECLARED = 100;
const MAX_CHECKLISTS = 200;
const DECLARED_KEY = /^[A-Za-z0-9_:.-]{1,100}$/;
const POLICY_ID = /^[a-z0-9-]{1,100}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class Invalid extends Error {}

function fail(path: string, why: string): never {
  throw new Invalid(`${path}: ${why}`);
}

function record(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "not an object");
  return v as Record<string, unknown>;
}

/** 정해진 키만, 빠짐없이. */
function exact(v: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  const o = record(v, path);
  for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${path}.${k}`, "unknown key");
  for (const k of keys) if (!Object.prototype.hasOwnProperty.call(o, k)) fail(`${path}.${k}`, "missing");
  return o;
}

function nullable<T>(v: unknown, parse: (v: unknown) => T): T | null {
  return v === null ? null : parse(v);
}

function unknownOr<T>(v: unknown, parse: (v: unknown) => T): T | "unknown" {
  return v === "unknown" ? "unknown" : parse(v);
}

function str(v: unknown, path: string, max: number): string {
  if (typeof v !== "string" || v.length > max) fail(path, "not a string");
  return v;
}

function date(v: unknown, path: string, allowEmpty = false): string {
  if (typeof v !== "string" || !(DATE.test(v) || (allowEmpty && v === ""))) fail(path, "not a date");
  return v;
}

function timestamp(v: unknown, path: string): string {
  if (typeof v !== "string" || v.length > 40 || Number.isNaN(Date.parse(v))) fail(path, "not a timestamp");
  return v;
}

function num(v: unknown, path: string, max: number, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v))) {
    fail(path, "out of range");
  }
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(path, "not a boolean");
  return v;
}

function oneOf<T extends string>(v: unknown, path: string, values: readonly T[]): T {
  if (typeof v !== "string" || !(values as readonly string[]).includes(v)) fail(path, "not allowed");
  return v as T;
}

function keyList<T extends string>(v: unknown, path: string, allowed: readonly T[]): T[] {
  if (!Array.isArray(v) || v.length > allowed.length) fail(path, "not a key list");
  const keys = v.map((k, i) => oneOf(k, `${path}[${i}]`, allowed));
  if (new Set(keys).size !== keys.length) fail(path, "duplicate key");
  return keys;
}

function parseAnswers(v: unknown, path: string): UserDataContent["answers"] {
  const o = exact(v, path, ["values", "answeredKeys"]);
  const p = `${path}.values`;
  const a = exact(o.values, p, DISCOVERY_KEYS);
  return {
    values: {
      birthDate: nullable(a.birthDate, (x) => date(x, `${p}.birthDate`)),
      region: nullable(a.region, (x) => str(x, `${p}.region`, 60)),
      status: nullable(a.status, (x) => oneOf(x, `${p}.status`, STATUSES)),
      incomeBracket: nullable(a.incomeBracket, (x) => num(x, `${p}.incomeBracket`, 20, true)),
      housingType: nullable(a.housingType, (x) => oneOf(x, `${p}.housingType`, HOUSING_TYPES)),
    },
    answeredKeys: keyList(o.answeredKeys, `${path}.answeredKeys`, DISCOVERY_KEYS),
  };
}

function parseListing(v: unknown, path: string): ListingInput {
  const o = exact(v, path, LISTING_KEYS);
  return {
    region: str(o.region, `${path}.region`, 60),
    contractType: oneOf(o.contractType, `${path}.contractType`, CONTRACT_TYPES),
    deposit: num(o.deposit, `${path}.deposit`, 10_000_000_000),
    rentOrYearlyAmount: num(o.rentOrYearlyAmount, `${path}.rentOrYearlyAmount`, 10_000_000_000),
    managementFee: num(o.managementFee, `${path}.managementFee`, 1_000_000_000),
    oneTimeMoveCost: num(o.oneTimeMoveCost, `${path}.oneTimeMoveCost`, 10_000_000_000),
    contractStartDate: date(o.contractStartDate, `${path}.contractStartDate`, true),
    months: num(o.months, `${path}.months`, 600, true),
    confirmedMatchesActualContract: bool(o.confirmedMatchesActualContract, `${path}.confirmedMatchesActualContract`),
  };
}

function parseProfile(v: unknown, path: string): NonNullable<UserDataContent["profile"]> {
  const o = exact(v, path, ["values", "answeredKeys"]);
  const p = `${path}.values`;
  const a = exact(o.values, p, ELIGIBILITY_KEYS);
  const yesNo = (k: (typeof YES_NO_KEYS)[number]) => unknownOr(a[k], (x) => bool(x, `${p}.${k}`));
  const money = (k: (typeof MONEY_KEYS)[number]) =>
    unknownOr(a[k], (x) => num(x, `${p}.${k}`, 10_000_000_000));
  return {
    values: {
      birthDate: date(a.birthDate, `${p}.birthDate`, true),
      isStudentOrEmployed: oneOf(a.isStudentOrEmployed, `${p}.isStudentOrEmployed`, WORK_STATUSES),
      livesApartFromParents: yesNo("livesApartFromParents"),
      canRegisterResidence: yesNo("canRegisterResidence"),
      hasNoHouse: yesNo("hasNoHouse"),
      isContractHolder: yesNo("isContractHolder"),
      householdSize: unknownOr(a.householdSize, (x) => num(x, `${p}.householdSize`, 99, true)),
      useOriginHousehold: yesNo("useOriginHousehold"),
      ownHouseholdMonthlyIncome: money("ownHouseholdMonthlyIncome"),
      originHouseholdMonthlyIncome: money("originHouseholdMonthlyIncome"),
      assetsUnder107M: yesNo("assetsUnder107M"),
      isBasicLivelihoodRecipient: yesNo("isBasicLivelihoodRecipient"),
      isNearPovertyClass: yesNo("isNearPovertyClass"),
      receivingOtherRentSupport: yesNo("receivingOtherRentSupport"),
      jeonbukResidentOverOneYear: yesNo("jeonbukResidentOverOneYear"),
      employedInTargetSectorOver3Months: yesNo("employedInTargetSectorOver3Months"),
    },
    answeredKeys: nullable(o.answeredKeys, (x) => keyList(x, `${path}.answeredKeys`, ELIGIBILITY_KEYS)),
  };
}

function parseDeclared(v: unknown, path: string): Record<string, DeclaredValue> {
  const entries = Object.entries(record(v, path));
  if (entries.length > MAX_DECLARED) fail(path, "too many entries");
  const out: Record<string, DeclaredValue> = {};
  for (const [key, value] of entries) {
    // 키는 판정 조건 이름(check.key)이다. "__proto__" 처럼 원형을 건드리는 키는 막는다.
    if (!DECLARED_KEY.test(key) || key.startsWith("__")) fail(path, "bad key");
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = str(value, `${path}.${key}`, 200);
    else out[key] = num(value, `${path}.${key}`, 10_000_000_000);
  }
  return out;
}

function parseChecklists(v: unknown, path: string): Record<string, ChecklistState> {
  const entries = Object.entries(record(v, path));
  if (entries.length > MAX_CHECKLISTS) fail(path, "too many entries");
  const out: Record<string, ChecklistState> = {};
  for (const [policyId, state] of entries) {
    if (!POLICY_ID.test(policyId)) fail(path, "bad policy id");
    const p = `${path}.${policyId}`;
    const s = exact(state, p, ["eligibility", "period", "documents"]);
    out[policyId] = {
      eligibility: bool(s.eligibility, `${p}.eligibility`),
      period: bool(s.period, `${p}.period`),
      documents: bool(s.documents, `${p}.documents`),
    };
  }
  return out;
}

function parsePayload(v: unknown, path: string): UserDataPayload {
  const o = exact(v, path, PAYLOAD_KEYS);
  if (o.schemaVersion !== SCHEMA_VERSION) fail(`${path}.schemaVersion`, "unsupported version");
  if (o.consentVersion !== CONSENT_VERSION) fail(`${path}.consentVersion`, "consent required");
  return {
    schemaVersion: SCHEMA_VERSION,
    consentVersion: CONSENT_VERSION,
    consentAt: timestamp(o.consentAt, `${path}.consentAt`),
    answers: parseAnswers(o.answers, `${path}.answers`),
    listing: nullable(o.listing, (x) => parseListing(x, `${path}.listing`)),
    profile: nullable(o.profile, (x) => parseProfile(x, `${path}.profile`)),
    declared: nullable(o.declared, (x) => parseDeclared(x, `${path}.declared`)),
    checklists: parseChecklists(o.checklists, `${path}.checklists`),
  };
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function attempt<T>(parse: () => T): Validation<T> {
  try {
    return { ok: true, value: parse() };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}

export function validateUserData(input: unknown): Validation<UserDataPayload> {
  return attempt(() => parsePayload(input, "data"));
}

export function validatePutRequest(input: unknown): Validation<PutRequestBody> {
  return attempt(() => {
    const o = exact(input, "body", ["data", "baseUpdatedAt"]);
    return {
      data: parsePayload(o.data, "body.data"),
      baseUpdatedAt: nullable(o.baseUpdatedAt, (x) => timestamp(x, "body.baseUpdatedAt")),
    };
  });
}

export function emptyContent(): UserDataContent {
  return {
    answers: {
      values: { birthDate: null, region: null, status: null, incomeBracket: null, housingType: null },
      answeredKeys: [],
    },
    listing: null,
    profile: null,
    declared: null,
    checklists: {},
  };
}

/**
 * 이 기기의 사본을 서버 형식으로 다듬는다. 형식에 안 맞는 묶음은 그 묶음만 버린다 —
 * 계약 조건 하나가 깨졌다고 1층 답까지 못 올리면 안 된다.
 */
export function sanitizeContent(
  raw: Record<"answers" | "listing" | "profile" | "declared" | "checklists", unknown>
): UserDataContent {
  const keep = <T>(parse: () => T, fallback: T): T => {
    const result = attempt(parse);
    return result.ok ? result.value : fallback;
  };
  const declared = keep(() => nullable(raw.declared, (x) => parseDeclared(x, "declared")), null);
  return {
    answers: keep(() => parseAnswers(raw.answers, "answers"), emptyContent().answers),
    listing: keep(() => nullable(raw.listing, (x) => parseListing(x, "listing")), null),
    profile: keep(() => nullable(raw.profile, (x) => parseProfile(x, "profile")), null),
    declared: declared && Object.keys(declared).length > 0 ? declared : null,
    checklists: keep(() => parseChecklists(raw.checklists, "checklists"), {}),
  };
}

export function isEmptyContent(c: UserDataContent): boolean {
  return (
    Object.values(c.answers.values).every((v) => v === null) &&
    c.answers.answeredKeys.length === 0 &&
    c.listing === null &&
    c.profile === null &&
    (c.declared === null || Object.keys(c.declared).length === 0) &&
    Object.keys(c.checklists).length === 0
  );
}

/** 저장 묶음에서 답만 꺼낸다(동의 시각·버전 같은 머리 정보를 뺀다). */
export function contentOf(c: UserDataContent): UserDataContent {
  return {
    answers: c.answers,
    listing: c.listing,
    profile: c.profile,
    declared: c.declared && Object.keys(c.declared).length > 0 ? c.declared : null,
    checklists: c.checklists,
  };
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, stable(o[k])]));
  }
  return v;
}

/** 키 순서와 상관없이 답이 같은가. 처음 로그인 때 "무엇을 쓸까요?"를 물을지 정한다. */
export function sameContent(a: UserDataContent, b: UserDataContent): boolean {
  return JSON.stringify(stable(contentOf(a))) === JSON.stringify(stable(contentOf(b)));
}
