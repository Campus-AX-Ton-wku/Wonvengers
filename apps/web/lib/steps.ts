import type { RequiredInputKey } from "./types";
import type { QuestionDef } from "./questions";

/**
 * 정책 판정 질문을 주제별로 묶는다. 한 화면에 다 쌓아두면 문항 수에 눌려
 * 이탈한다는 판단에 따른 분할이라, 질문 자체와 판정 규칙은 바뀌지 않는다.
 *
 * QUESTION_REGISTRY 의 모든 키가 정확히 한 그룹에 들어가야 한다.
 * (policies.json 에 정책이 추가돼 새 질문이 생겼는데 여기 빠지면
 *  폼에서 조용히 사라진다 — steps.test.ts 가 이걸 잡는다.)
 */
export const QUESTION_GROUPS: { title: string; heading: string; keys: RequiredInputKey[] }[] = [
  {
    title: "기본 자격",
    heading: "기본 자격을 확인할게요",
    keys: [
      "birthDate",
      "isStudentOrEmployed",
      "livesApartFromParents",
      "canRegisterResidence",
      "hasNoHouse",
      "isContractHolder",
    ],
  },
  {
    title: "가구 · 소득",
    heading: "가구와 소득을 알려주세요",
    keys: [
      "householdSize",
      "useOriginHousehold",
      "ownHouseholdMonthlyIncome",
      "originHouseholdMonthlyIncome",
    ],
  },
  {
    title: "재산 · 지역 요건",
    heading: "재산과 지역 요건을 확인할게요",
    keys: [
      "assetsUnder107M",
      "isBasicLivelihoodRecipient",
      "isNearPovertyClass",
      "receivingOtherRentSupport",
      "jeonbukResidentOverOneYear",
      "employedInTargetSectorOver3Months",
    ],
  },
];

/** 실제로 물어볼 질문만 그룹에 채운다. 질문이 하나도 없는 그룹은 화면에서 뺀다. */
export function buildQuestionSteps(
  questions: QuestionDef[]
): { title: string; heading: string; questions: QuestionDef[] }[] {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  return QUESTION_GROUPS.map((g) => ({
    title: g.title,
    heading: g.heading,
    questions: g.keys.map((k) => byKey.get(k)).filter((q): q is QuestionDef => Boolean(q)),
  })).filter((g) => g.questions.length > 0);
}
