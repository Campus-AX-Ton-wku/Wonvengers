import type { PolicyMeta, RequiredInputKey } from "./types";

export type QuestionType = "date" | "boolean" | "number" | "select";

export interface QuestionDef {
  key: RequiredInputKey;
  label: string;
  why: string;
  type: QuestionType;
  options?: { value: string; label: string }[];
  allowUnknown: boolean;
}

export const QUESTION_REGISTRY: Record<RequiredInputKey, QuestionDef> = {
  birthDate: {
    key: "birthDate",
    label: "생년월일",
    why: "대부분의 청년 주거지원 정책은 만 19~39세 사이에서 나이 상한·하한을 둡니다.",
    type: "date",
    allowUnknown: false,
  },
  isStudentOrEmployed: {
    key: "isStudentOrEmployed",
    label: "현재 상태 (재학·재직 등)",
    why: "일부 정책은 재직·재학 여부에 따라 요건이 달라집니다.",
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
    why: "독립거주를 요구하는 정책이 많습니다.",
    type: "boolean",
    allowUnknown: true,
  },
  canRegisterResidence: {
    key: "canRegisterResidence",
    label: "해당 주소로 전입신고가 가능한가요?",
    why: "임대인 반대 등으로 전입신고가 불가능하면 대상에서 제외될 수 있습니다.",
    type: "boolean",
    allowUnknown: true,
  },
  hasNoHouse: {
    key: "hasNoHouse",
    label: "무주택자인가요? (본인 명의 주택 없음)",
    why: "청년 주거지원 정책은 대부분 무주택자만 대상으로 합니다.",
    type: "boolean",
    allowUnknown: true,
  },
  isContractHolder: {
    key: "isContractHolder",
    label: "임대차계약의 명의가 본인인가요?",
    why: "계약 명의자 본인만 신청 가능한 정책이 있습니다.",
    type: "boolean",
    allowUnknown: true,
  },
  householdSize: {
    key: "householdSize",
    label: "본인 가구원 수",
    why: "소득 기준(중위소득 몇 %)은 가구원 수에 따라 달라집니다.",
    type: "number",
    allowUnknown: true,
  },
  useOriginHousehold: {
    key: "useOriginHousehold",
    label: "원가구(부모님 등) 소득도 함께 심사받나요?",
    why: "30세 이상이거나 독립생계가 인정되면 원가구 소득 기준이 적용되지 않을 수 있습니다. 모르면 '모름'을 선택하세요.",
    type: "boolean",
    allowUnknown: true,
  },
  ownHouseholdMonthlyIncome: {
    key: "ownHouseholdMonthlyIncome",
    label: "본인 가구의 월 소득 (원)",
    why: "공식 소득인정액을 모르면 임의로 추정하지 말고 '모름'을 선택하세요 (F2-5).",
    type: "number",
    allowUnknown: true,
  },
  originHouseholdMonthlyIncome: {
    key: "originHouseholdMonthlyIncome",
    label: "원가구(부모님 등)의 월 소득 (원)",
    why: "원가구 소득 기준이 있는 정책 판정에 사용됩니다.",
    type: "number",
    allowUnknown: true,
  },
  assetsUnder107M: {
    key: "assetsUnder107M",
    label: "본인 가구 재산 가액이 1억 700만원 이하인가요?",
    why: "일부 지역 정책은 소득뿐 아니라 재산 기준도 함께 봅니다.",
    type: "boolean",
    allowUnknown: true,
  },
  isBasicLivelihoodRecipient: {
    key: "isBasicLivelihoodRecipient",
    label: "기초생활수급자인가요?",
    why: "복지 자격에 따라 우대·별도 규칙이 적용되는 정책이 있습니다.",
    type: "boolean",
    allowUnknown: true,
  },
  isNearPovertyClass: {
    key: "isNearPovertyClass",
    label: "차상위계층인가요?",
    why: "복지 자격에 따라 우대·별도 규칙이 적용되는 정책이 있습니다.",
    type: "boolean",
    allowUnknown: true,
  },
  receivingOtherRentSupport: {
    key: "receivingOtherRentSupport",
    label: "현재 다른 월세·주거비 지원을 받고 있나요?",
    why: "같은 성격의 지원은 중복 수급이 제한됩니다.",
    type: "boolean",
    allowUnknown: true,
  },
  jeonbukResidentOverOneYear: {
    key: "jeonbukResidentOverOneYear",
    label: "전북특별자치도에 1년 이상 거주했나요?",
    why: "전북 지역 정착 지원사업의 거주 요건입니다.",
    type: "boolean",
    allowUnknown: true,
  },
  employedInTargetSectorOver3Months: {
    key: "employedInTargetSectorOver3Months",
    label: "농업·임업·어업·중소기업(정규직)·문화예술·연구소기업(정규직)에 3개월 이상 재직 중인가요?",
    why: "전북 지역 정착 지원사업은 특정 업종 재직을 요구합니다.",
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
