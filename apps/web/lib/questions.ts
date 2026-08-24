import type { PolicyMeta, RequiredInputKey } from "./types";

export type QuestionType = "date" | "boolean" | "number" | "select";

export interface QuestionDef {
  key: RequiredInputKey;
  label: string;
  type: QuestionType;
  /** 만원 단위로 입력받는 금액 질문. 저장·판정은 그대로 원 단위다. */
  money?: boolean;
  options?: { value: string; label: string }[];
  allowUnknown: boolean;
}

export const QUESTION_REGISTRY: Record<RequiredInputKey, QuestionDef> = {
  birthDate: {
    key: "birthDate",
    label: "생년월일",
    type: "date",
    allowUnknown: false,
  },
  isStudentOrEmployed: {
    key: "isStudentOrEmployed",
    label: "현재 상태 (재학·재직 등)",
    type: "select",
    options: [
      { value: "student", label: "재학/휴학" },
      { value: "employed", label: "재직" },
      { value: "unemployed", label: "구직/미취업" },
    ],
    allowUnknown: true,
  },
  livesApartFromParents: {
    key: "livesApartFromParents",
    label: "부모와 별도로 거주하나요?",
    type: "boolean",
    allowUnknown: true,
  },
  canRegisterResidence: {
    key: "canRegisterResidence",
    label: "해당 주소로 전입신고가 가능한가요?",
    type: "boolean",
    allowUnknown: true,
  },
  hasNoHouse: {
    key: "hasNoHouse",
    label: "무주택자인가요? (본인 명의 주택 없음)",
    type: "boolean",
    allowUnknown: true,
  },
  isContractHolder: {
    key: "isContractHolder",
    label: "임대차계약의 명의가 본인인가요?",
    type: "boolean",
    allowUnknown: true,
  },
  householdSize: {
    key: "householdSize",
    label: "본인 가구원 수",
    type: "number",
    allowUnknown: true,
  },
  useOriginHousehold: {
    key: "useOriginHousehold",
    label: "원가구(부모님 등) 소득도 함께 심사받나요?",
    type: "boolean",
    allowUnknown: true,
  },
  ownHouseholdMonthlyIncome: {
    key: "ownHouseholdMonthlyIncome",
    label: "본인 가구의 월 소득 (만원)",
    type: "number",
    money: true,
    allowUnknown: true,
  },
  originHouseholdMonthlyIncome: {
    key: "originHouseholdMonthlyIncome",
    label: "원가구(부모님 등)의 월 소득 (만원)",
    type: "number",
    money: true,
    allowUnknown: true,
  },
  assetsUnder107M: {
    key: "assetsUnder107M",
    label: "본인 가구 재산 가액이 1억 700만원 이하인가요?",
    type: "boolean",
    allowUnknown: true,
  },
  isBasicLivelihoodRecipient: {
    key: "isBasicLivelihoodRecipient",
    label: "기초생활수급자인가요?",
    type: "boolean",
    allowUnknown: true,
  },
  isNearPovertyClass: {
    key: "isNearPovertyClass",
    label: "차상위계층인가요?",
    type: "boolean",
    allowUnknown: true,
  },
  receivingOtherRentSupport: {
    key: "receivingOtherRentSupport",
    label: "현재 다른 월세·주거비 지원을 받고 있나요?",
    type: "boolean",
    allowUnknown: true,
  },
  jeonbukResidentOverOneYear: {
    key: "jeonbukResidentOverOneYear",
    label: "전북특별자치도에 1년 이상 거주했나요?",
    type: "boolean",
    allowUnknown: true,
  },
  employedInTargetSectorOver3Months: {
    key: "employedInTargetSectorOver3Months",
    label: "농업·임업·어업·중소기업(정규직)·문화예술·연구소기업(정규직)에 3개월 이상 재직 중인가요?",
    type: "boolean",
    allowUnknown: true,
  },
};

/** 후보 정책들의 required_inputs 합집합을 만들어 중복 질문을 제거한다 (F2-8). */
export function getRequiredQuestions(policies: PolicyMeta[]): QuestionDef[] {
  const keys = new Set<RequiredInputKey>();
  for (const policy of policies) {
    for (const key of policy.requiredInputs) keys.add(key);
  }
  return Array.from(keys).map((key) => QUESTION_REGISTRY[key]);
}
