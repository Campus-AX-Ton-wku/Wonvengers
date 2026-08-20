import type { DiscoveryAnswers, DiscoveryStatus, PolicyMeta, TagResult } from "./types";
import { policyAppliesToRegion } from "./region";

/**
 * 1층 태그 판정.
 *
 * discovery 4개 필드만 본다. 전체 자격 판정이 아니다 — 무주택·가구소득 같은
 * 추가 조건은 2층(/eligibility)에서 판정한다. (PRD F0-5)
 *
 * 명확한 불일치가 하나라도 있으면 '모름'이 함께 있어도 '해당 없음'이다. (PRD F0-5a)
 * discovery 값이 null 인 항목은 추정하지 않고 '모름'으로 처리한다.
 */

type CheckResult = { result: "pass" | "fail" | "unknown"; reason: string };

const PASS: CheckResult = { result: "pass", reason: "" };
const UNKNOWN: CheckResult = { result: "unknown", reason: "" };

function checkAge(policy: PolicyMeta, age: number | null): CheckResult {
  if (age === null) return UNKNOWN;
  const { ageMin, ageMax } = policy.discovery;
  // 셋 중 하나라도 숫자로 비교할 수 없으면(정책 데이터 입력 실수 등) 통과시키지
  // 않는다. NaN 비교는 항상 false 라서 그냥 두면 자격 없는 사람도 '가능성 있음'이
  // 되어 버린다. 판단할 수 없을 땐 '확인 필요'가 정직한 답이다.
  if (!Number.isFinite(age) || !Number.isFinite(ageMin) || !Number.isFinite(ageMax)) {
    return UNKNOWN;
  }
  if (age < ageMin) return { result: "fail", reason: `만 ${ageMin}세 이상만 신청할 수 있습니다` };
  if (age > ageMax) return { result: "fail", reason: `만 ${ageMax}세 이하만 신청할 수 있습니다` };
  return PASS;
}

function checkRegion(policy: PolicyMeta, region: string | null): CheckResult {
  if (region === null) return UNKNOWN;
  // 2층과 같은 지역 매칭 규칙을 쓴다. 지역 어휘가 갈라지면 두 층의 결과가 어긋난다.
  if (!policyAppliesToRegion(policy.regionScope, region)) {
    return { result: "fail", reason: `${policy.regionScope} 거주자만 신청할 수 있습니다` };
  }
  return PASS;
}

function checkStatus(policy: PolicyMeta, status: DiscoveryStatus | null): CheckResult {
  const allowed = policy.discovery.statuses;
  if (allowed === null) return UNKNOWN; // 공고 확인 전 — 추정하지 않는다
  if (status === null) return UNKNOWN;
  if (!allowed.includes(status)) {
    return { result: "fail", reason: `${allowed.join(" · ")}만 신청할 수 있습니다` };
  }
  return PASS;
}

function checkIncome(policy: PolicyMeta, incomeBracket: number | null): CheckResult {
  const max = policy.discovery.incomeBracketMax;
  if (max === null) return UNKNOWN; // 공고 확인 전 — 추정하지 않는다
  if (incomeBracket === null) return UNKNOWN;
  // checkAge 와 같은 이유 — 비교할 수 없으면 통과시키지 않는다.
  if (!Number.isFinite(incomeBracket) || !Number.isFinite(max)) return UNKNOWN;
  if (incomeBracket > max) return { result: "fail", reason: "소득 기준을 넘습니다" };
  return PASS;
}

export function tagPolicy(policy: PolicyMeta, answers: DiscoveryAnswers): TagResult {
  const checks = [
    { field: "나이", ...checkAge(policy, answers.age) },
    { field: "지역", ...checkRegion(policy, answers.region) },
    { field: "현재 상태", ...checkStatus(policy, answers.status) },
    { field: "소득 구간", ...checkIncome(policy, answers.incomeBracket) },
  ];

  const failReasons = checks.filter((c) => c.result === "fail").map((c) => c.reason);
  if (failReasons.length > 0) return { tag: "해당 없음", failReasons, unknownFields: [] };

  const unknownFields = checks.filter((c) => c.result === "unknown").map((c) => c.field);
  if (unknownFields.length > 0) return { tag: "확인 필요", failReasons: [], unknownFields };

  return { tag: "가능성 있음", failReasons: [], unknownFields: [] };
}
