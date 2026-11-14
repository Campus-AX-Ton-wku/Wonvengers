import verificationJson from "@/data/verification.json";
import type { LoanProductMeta, PolicyMeta } from "./types";

/**
 * 팀 검수 결과(Supabase)를 화면에 붙인다.
 *
 * 앱은 Supabase 를 직접 부르지 않는다. scripts/verification-snapshot.sql 로 뽑은 결과를
 * data/verification.json 에 저장해 두고 그 파일만 읽는다 — Supabase 가 멈추거나 무료 플랜이
 * 일시 정지돼도 화면 · 배포는 그대로다. 정책 값(금액 · 나이 · 기간)은 지금처럼 정책 JSON 에서
 * 읽고, 여기서는 '누가 원문과 대조해 맞다고 확인했는가'만 가져온다.
 *
 * 배지는 거짓말하지 않아야 한다. 화면에 보이는 값이 검수한 값과 한 칸이라도 다르면
 * (JSON 을 고쳤는데 DB 는 그대로이거나 그 반대) 배지를 붙이지 않는다. 그 목록은
 * lib/__tests__/verification.test.ts 가 보여 준다.
 */

export type TrustLevel = "교차검수" | "검수" | "미검수" | "재확인 필요";

/** DB 의 정책 값 중 앱 JSON 과 견주는 칸. scripts/verification-snapshot.sql 의 values 와 같다. */
export interface VerifiedValues {
  summary: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  ageMin: number | null;
  ageMax: number | null;
  statuses: string[] | null;
  incomeBracketMin: number | null;
  incomeBracketMax: number | null;
  housingTypes: string[] | null;
  monthlyCap: number | null;
  maxMonths: number | null;
  lumpSumCap: number | null;
}

export interface VerificationEntry {
  trustLevel: TrustLevel;
  version: number;
  /** 지금 버전에서 원문 대조 · 전화 문의로 '일치'를 남긴 서로 다른 사람 수 */
  confirmers: number;
  /** 그 마지막 확인 날짜 YYYY-MM-DD. 없으면 null */
  lastConfirmedAt: string | null;
  methods: string[];
  sourceUrl: string | null;
  values: VerifiedValues;
}

export interface VerificationSnapshot {
  generatedAt: string;
  source: string;
  policies: Record<string, VerificationEntry>;
}

export const VERIFICATION = verificationJson as VerificationSnapshot;

type Item = PolicyMeta | LoanProductMeta;
const isPolicy = (item: Item): item is PolicyMeta => "discovery" in item;

const sameList = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined) => {
  if (a == null || b == null) return (a ?? null) === (b ?? null);
  return [...a].sort().join("|") === [...b].sort().join("|");
};

/** 앱이 화면에 쓰는 값을 DB 칸 이름으로 옮긴다. 대출 · 보증 · 저축 상품은 요약 문구만 화면에 쓴다. */
function appValues(item: Item): Partial<VerifiedValues> {
  if (!isPolicy(item)) return { summary: item.summary };
  const d = item.discovery;
  return {
    summary: item.benefitSummary,
    applyStart: item.applicationStart,
    applyEnd: item.applicationEnd,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
    statuses: d.statuses,
    incomeBracketMin: d.incomeBracketMin,
    incomeBracketMax: d.incomeBracketMax,
    housingTypes: d.housingTypes,
    monthlyCap: item.monthlyCap ?? null,
    maxMonths: item.maxMonths ?? null,
    lumpSumCap: item.lumpSumCap ?? null,
  };
}

/**
 * 화면 값과 검수 값이 다른 칸 이름. 검수 기록이 없으면 null.
 * 빈 배열 = 화면에 보이는 값이 모두 검수한 값과 같다.
 */
export function verificationMismatches(item: Item, snapshot: VerificationSnapshot = VERIFICATION): string[] | null {
  const entry = snapshot.policies[item.id];
  if (!entry) return null;
  const app = appValues(item);
  const diff: string[] = [];
  for (const [key, value] of Object.entries(app) as [keyof VerifiedValues, unknown][]) {
    const db = entry.values[key];
    const same = Array.isArray(value) || Array.isArray(db)
      ? sameList(value as string[] | null, db as string[] | null)
      : (value ?? null) === (db ?? null);
    if (!same) diff.push(key);
  }
  return diff;
}

export interface VerificationBadge {
  trustLevel: "교차검수" | "검수";
  confirmers: number;
  lastConfirmedAt: string;
  /** 카드에 붙는 짧은 말. '공고 원문과 대조'는 상세 화면 문구라 겹치지 않게 짧게 쓴다. */
  label: string;
}

/**
 * 검수를 마쳤고(검수 · 교차검수) 화면 값이 검수한 값과 같을 때만 배지를 준다.
 * 미검수 · 재확인 필요 · 값이 다름 · 기록 없음은 모두 null — 배지를 붙이지 않는다.
 */
export function verificationBadge(item: Item, snapshot: VerificationSnapshot = VERIFICATION): VerificationBadge | null {
  const entry = snapshot.policies[item.id];
  if (!entry || entry.lastConfirmedAt === null) return null;
  if (entry.trustLevel !== "검수" && entry.trustLevel !== "교차검수") return null;
  const mismatches = verificationMismatches(item, snapshot);
  if (mismatches === null || mismatches.length > 0) return null;
  return {
    trustLevel: entry.trustLevel,
    confirmers: entry.confirmers,
    lastConfirmedAt: entry.lastConfirmedAt,
    label: entry.trustLevel === "교차검수" ? `원문 확인 · ${entry.confirmers}명` : "원문 확인",
  };
}
