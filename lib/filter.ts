import type { Answers, Policy, Region, Status, TagResult } from "@/lib/types";

// 사용자가 고른 지역이 어떤 범위의 정책까지 포함되는지 나타낸다.
// 예: 익산시 거주자는 익산시 정책, 전라북도 정책, 전국 정책의 대상이 될 수 있다.
const REGION_SCOPES: Record<Region, string[]> = {
  "익산시": ["익산시", "전라북도", "전국"],
  "전라북도 (익산 외)": ["전라북도", "전국"],
  "그 외 지역": ["전국"],
};

type CheckResult = { result: "pass" | "fail" | "unknown"; reason: string };

const PASS: CheckResult = { result: "pass", reason: "" };
const UNKNOWN: CheckResult = { result: "unknown", reason: "" };

function checkAge(policy: Policy, age: number | null): CheckResult {
  if (age === null) return UNKNOWN;
  const { age_min, age_max } = policy.filter;
  if (age < age_min) return { result: "fail", reason: `만 ${age_min}세 이상만 신청할 수 있습니다` };
  if (age > age_max) return { result: "fail", reason: `만 ${age_max}세 이하만 신청할 수 있습니다` };
  return PASS;
}

function checkRegion(policy: Policy, region: Region | null): CheckResult {
  if (region === null) return UNKNOWN;
  const scopes = REGION_SCOPES[region];
  const matched = policy.filter.regions.some((r) => scopes.includes(r));
  if (!matched) {
    return {
      result: "fail",
      reason: `${policy.filter.regions.join(" · ")} 거주자만 신청할 수 있습니다`,
    };
  }
  return PASS;
}

function checkStatus(policy: Policy, status: Status | null): CheckResult {
  if (status === null) return UNKNOWN;
  if (!policy.filter.statuses.includes(status)) {
    return {
      result: "fail",
      reason: `${policy.filter.statuses.join(" · ")}만 신청할 수 있습니다`,
    };
  }
  return PASS;
}

function checkIncome(policy: Policy, incomeBracket: number | null): CheckResult {
  if (incomeBracket === null) return UNKNOWN;
  if (incomeBracket > policy.filter.income_bracket_max) {
    return { result: "fail", reason: "소득 기준을 넘습니다" };
  }
  return PASS;
}

/**
 * 정책 하나에 대해 1층 태그를 판정한다.
 *
 * `filter` 4개 필드만 본다. 전체 자격 판정이 아니다 — 무주택·가구소득 같은
 * 추가 조건은 판정하지 않고 화면에 그대로 나열한다. (PRD F0-5)
 *
 * 명확한 불일치가 하나라도 있으면 `모름`이 함께 있어도 `해당 없음`이다. (PRD F0-5a)
 */
export function tagPolicy(policy: Policy, answers: Answers): TagResult {
  const checks = [
    { field: "나이", ...checkAge(policy, answers.age) },
    { field: "지역", ...checkRegion(policy, answers.region) },
    { field: "현재 상태", ...checkStatus(policy, answers.status) },
    { field: "소득 구간", ...checkIncome(policy, answers.incomeBracket) },
  ];

  const failReasons = checks
    .filter((c) => c.result === "fail")
    .map((c) => c.reason);
  if (failReasons.length > 0) {
    return { tag: "해당 없음", failReasons, unknownFields: [] };
  }

  const unknownFields = checks
    .filter((c) => c.result === "unknown")
    .map((c) => c.field);
  if (unknownFields.length > 0) {
    return { tag: "확인 필요", failReasons: [], unknownFields };
  }

  return { tag: "가능성 있음", failReasons: [], unknownFields: [] };
}
