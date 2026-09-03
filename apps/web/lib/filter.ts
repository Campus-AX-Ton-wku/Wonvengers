import type {
  DiscoveryStatus,
  HousingType,
  PolicyMeta,
  PolicyResult,
  ResolvedAnswers,
  TagResult,
} from "./types";
import { policyAppliesToRegion } from "./region";

/**
 * 1층 태그 판정.
 *
 * discovery 필드만 본다. 전체 자격 판정이 아니다 — 무주택·가구소득 같은
 * 추가 조건은 2층(/eligibility)에서 판정한다. (PRD F0-5)
 *
 * 명확한 불일치가 하나라도 있으면 '모름'이 함께 있어도 '해당 없음'이다. (PRD F0-5a)
 * discovery 값이 null 인 항목은 추정하지 않고 '모름'으로 처리한다.
 */

type CheckResult = { result: "pass" | "fail" | "unknown"; reason: string };

const PASS: CheckResult = { result: "pass", reason: "" };
const UNKNOWN: CheckResult = { result: "unknown", reason: "" };

function checkAge(policy: PolicyMeta, age: number | null): CheckResult {
  const { ageMin, ageMax } = policy.discovery;
  // 나이 제한이 없는 정책은 나이를 몰라도 통과다. 여기서 UNKNOWN 을 돌려주면
  // 나이가 조건이 아닌 정책이 생년월일을 안 답했다는 이유로 '확인 필요'가 된다.
  if (ageMin === null && ageMax === null) return PASS;
  if (age === null) return UNKNOWN;
  // 숫자로 비교할 수 없으면(정책 데이터 입력 실수 등) 통과시키지 않는다. NaN
  // 비교는 항상 false 라서 그냥 두면 자격 없는 사람도 '가능성 있음'이 되어 버린다.
  // 판단할 수 없을 땐 '확인 필요'가 정직한 답이다.
  if (!Number.isFinite(age)) return UNKNOWN;
  if (ageMin !== null) {
    if (!Number.isFinite(ageMin)) return UNKNOWN;
    if (age < ageMin) return { result: "fail", reason: `만 ${ageMin}세 이상만 신청할 수 있습니다` };
  }
  if (ageMax !== null) {
    if (!Number.isFinite(ageMax)) return UNKNOWN;
    if (age > ageMax) return { result: "fail", reason: `만 ${ageMax}세 이하만 신청할 수 있습니다` };
  }
  return PASS;
}

/**
 * 주거 형태 판정.
 *
 * housingTypes 가 null 이면 계약 형태를 따지지 않는 정책이라 통과다
 * (types.ts 의 PolicyDiscovery 주석 참고). 답하지 않았으면 추정하지 않고
 * '확인 필요'로 남긴다.
 */
function checkHousingType(policy: PolicyMeta, housingType: HousingType | null): CheckResult {
  const allowed = policy.discovery.housingTypes;
  if (allowed === null) return PASS;
  if (housingType === null) return UNKNOWN;
  if (!allowed.includes(housingType)) {
    return { result: "fail", reason: `${allowed.join(" · ")} 거주자만 신청할 수 있습니다` };
  }
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
  const { incomeBracketMin: min, incomeBracketMax: max } = policy.discovery;
  if (max === null) return UNKNOWN; // 공고 확인 전 — 추정하지 않는다
  if (incomeBracket === null) return UNKNOWN;
  // checkAge 와 같은 이유 — 비교할 수 없으면 통과시키지 않는다.
  if (!Number.isFinite(incomeBracket) || !Number.isFinite(max)) return UNKNOWN;
  if (incomeBracket > max) return { result: "fail", reason: "소득 기준을 넘습니다" };
  // 하한은 익산형 청년월세처럼 '소득이 일정 수준을 넘는 청년'만 받는 사업에만 있다.
  // min 이 null 이면 하한 조건이 없다는 뜻이므로 통과다 (types.ts 주석 참고).
  if (min !== null) {
    if (!Number.isFinite(min)) return UNKNOWN;
    if (incomeBracket < min) {
      return {
        result: "fail",
        reason: "소득이 일정 수준을 넘는 청년만 신청할 수 있습니다 (소득이 더 낮으면 다른 사업 대상입니다)",
      };
    }
  }
  return PASS;
}

/**
 * 2층(정밀 계산) 판정 결과를 1층 태그 모양으로 옮긴다.
 *
 * 2층까지 답한 사람에게 1층 태그를 그대로 보여주면 앱이 이미 아는 것을 잊는다 —
 * 결과 화면이 "예상 적용"이라고 한 정책의 상세를 열었더니 "조건 확인이 필요"라고
 * 말하는 모순이 실제로 났다. 특히 discovery.incomeBracketMax 가 null 인 정책
 * (청년 주거급여 분리지급 등)은 1층 소득 판정 자체가 불가능해서 무엇을 답하든
 * 영원히 '확인 필요'다. 그런 정책일수록 2층 결과를 써야 한다.
 */
export function tagFromEvaluation(result: PolicyResult): TagResult {
  switch (result.status) {
    case "대상아님":
      return { tag: "해당 없음", failReasons: result.failedLabels, unknownFields: [] };
    case "조건충족시가능":
      return { tag: "확인 필요", failReasons: [], unknownFields: result.unknownLabels };
    // "신청불가" 는 신청 기간 밖이라는 뜻뿐이다(lib/eligibility.ts). 기간은
    // cardStatus 가 직접 보고 '접수 마감'·'신청 예정'으로 바꾸므로 여기서 옮기지 않는다.
    default:
      return { tag: "가능성 있음", failReasons: [], unknownFields: [] };
  }
}

/**
 * 1층 태그와 2층 판정을 합친다. 2층을 안 거쳤으면(evaluated === null) 1층 그대로다.
 *
 * 어느 한 층으로 "통일"하면 다른 층이 아는 탈락을 잃는다. 두 층은 서로 다른 것을 본다:
 *
 *  - 1층(discovery)만 아는 것: 주거 형태 · 현재 상태 · 소득 구간 · 지역
 *  - 2층(policy-rules)만 아는 것: 무주택 · 원가구 소득 · 별도 거주 · 계약자 명의…
 *
 * 실제로 갈렸던 예:
 *  - 전세보증금반환보증 보증료 지원은 `housingTypes: ["전세"]` 다. 월세 사용자를
 *    1층은 '대상 아님'으로 정확히 거르지만, 2층 규칙은 주거 형태를 보지 않아
 *    '확인 필요'로 올린다. 2층만 쓰면 월세 사용자에게 전세 전용 사업이 다시 뜬다.
 *  - 청년 주거급여 분리지급은 `incomeBracketMax: null` 이라 1층 소득 판정이
 *    원천적으로 불가능해 무엇을 답하든 '확인 필요'다. 1층만 쓰면 2층이 실제 소득으로
 *    통과시킨 결과를 잃는다.
 *
 * 그래서 탈락은 어느 층이든 인정하고, 남은 판단만 2층에 맡긴다.
 */
export function combineTags(discovery: TagResult, evaluated: TagResult | null): TagResult {
  if (discovery.tag === "해당 없음") return discovery;
  return evaluated ?? discovery;
}

export function tagPolicy(policy: PolicyMeta, answers: ResolvedAnswers): TagResult {
  const checks = [
    { field: "나이", ...checkAge(policy, answers.age) },
    { field: "지역", ...checkRegion(policy, answers.region) },
    { field: "현재 상태", ...checkStatus(policy, answers.status) },
    { field: "소득 구간", ...checkIncome(policy, answers.incomeBracket) },
    { field: "주거 형태", ...checkHousingType(policy, answers.housingType) },
  ];

  const failReasons = checks.filter((c) => c.result === "fail").map((c) => c.reason);
  if (failReasons.length > 0) return { tag: "해당 없음", failReasons, unknownFields: [] };

  const unknownFields = checks.filter((c) => c.result === "unknown").map((c) => c.field);
  if (unknownFields.length > 0) return { tag: "확인 필요", failReasons: [], unknownFields };

  return { tag: "가능성 있음", failReasons: [], unknownFields: [] };
}
