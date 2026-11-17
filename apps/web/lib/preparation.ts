import { POLICY_RULES } from "./policy-rules";
import type { ChecklistState } from "./user-data";
import type { EligibilityProfile, PolicyMeta } from "./types";

/** 신청 준비 진행률 · 마감 표시 (docs/기획/2026-11-17-홈-찜하기-설계.md "2 · 3"). */

function documentsDone(policy: PolicyMeta, checked: readonly string[]): number {
  const names = new Set((policy.documents ?? []).map((d) => d.name));
  return checked.filter((n) => names.has(n)).length;
}

const checksDone = (c: ChecklistState) => [c.eligibility, c.period, c.documents].filter(Boolean).length;

/** 홈 카드: 서류 목록이 있으면 서류만, 없으면 확인 3개. */
export function homeProgress(policy: PolicyMeta, checklist: ChecklistState, checked: readonly string[]) {
  const docs = policy.documents ?? [];
  if (docs.length > 0) {
    const done = documentsDone(policy, checked);
    return { kind: "documents" as const, done, total: docs.length, label: `서류 ${done}/${docs.length} 준비` };
  }
  const done = checksDone(checklist);
  return { kind: "checks" as const, done, total: 3, label: `신청 준비 ${done}/3` };
}

/** 체크리스트 화면: 서류 있으면 자격 + 기간 + 서류 하나하나. */
export function pageProgress(policy: PolicyMeta, checklist: ChecklistState, checked: readonly string[]) {
  const docs = policy.documents ?? [];
  if (docs.length === 0) return { done: checksDone(checklist), total: 3 };
  const fixed = [checklist.eligibility, checklist.period].filter(Boolean).length;
  return { done: fixed + documentsDone(policy, checked), total: 2 + docs.length };
}

const DAY = 86_400_000;

export function deadlineLabel(policy: PolicyMeta, todayISO: string): string {
  if (todayISO < policy.applicationStart) return "신청 예정";
  if (policy.applicationEnd === null) return "상시";
  if (todayISO > policy.applicationEnd) return "접수 마감";
  const days = Math.round((Date.parse(policy.applicationEnd) - Date.parse(todayISO)) / DAY);
  return days === 0 ? "오늘 마감" : `D-${days}`;
}

/** 판정 질문에 아직 하나도 답하지 않은 사람 — 모든 답이 '모름'이다. */
const UNKNOWN_PROFILE: EligibilityProfile = {
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

/**
 * 신청 준비 체크리스트 '자격 조건 확인' 줄에 적을, 이 정책에서 아직 확인할 조건 (11/17).
 *
 * 결과 화면은 더 이상 정책별 조건을 따지게 하지 않는다 — 금액과 [신청 준비]·찜까지만 보여 주고,
 * 전입 이력처럼 앱이 공통 질문으로 묻지 않는 조건은 신청할 때 여기서 확인한다.
 * - 계산 전(프로필 없음): 그 정책만의 조건(ask 표시가 있는 것)만 — 나이·소득 같은 공통 조건까지
 *   늘어놓으면 목록이 길어지고, 그건 지원금 찾기 답으로 이미 걸렀다
 * - 계산 뒤: 아직 '모름'인 조건 전부(직접 답한 것은 뺀다)
 * - 판정 규칙이 없는 새 정책(DB 에만 등록): 공고 원문의 지원 대상
 */
export function conditionsToConfirm(
  policy: PolicyMeta,
  profile: EligibilityProfile | null,
  asOfISO: string
): string[] {
  const rule = POLICY_RULES[policy.id];
  if (!rule) return ["공고 원문의 지원 대상 · 제외 대상"];
  return rule(profile ?? UNKNOWN_PROFILE, asOfISO)
    .filter((check) => check.result === "unknown" && (profile !== null || check.ask !== undefined))
    .map((check) => check.label);
}
