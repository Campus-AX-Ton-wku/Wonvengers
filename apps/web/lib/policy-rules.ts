import type {
  Answer,
  CheckOutcome,
  CheckResult,
  DeclarableInput,
  DeclaredValue,
  EligibilityProfile,
} from "./types";
import { calcAge } from "./date";
import { medianIncomeCeiling } from "./income";

function boolCheck(
  key: string,
  label: string,
  value: Answer<boolean>,
  requireTrue: boolean,
  howToConfirm?: string
): CheckOutcome {
  const result: CheckResult = value === "unknown" ? "unknown" : value === requireTrue ? "pass" : "fail";
  return { key, label, result, howToConfirm };
}

function maxCeilingCheck(
  key: string,
  label: string,
  value: Answer<number>,
  ceiling: number,
  howToConfirm?: string
): CheckOutcome {
  const result: CheckResult = value === "unknown" ? "unknown" : value <= ceiling ? "pass" : "fail";
  return { key, label, result, howToConfirm };
}

function rangeCheck(
  key: string,
  label: string,
  value: Answer<number>,
  minExclusive: number,
  maxInclusive: number,
  howToConfirm?: string
): CheckOutcome {
  const result: CheckResult =
    value === "unknown" ? "unknown" : value > minExclusive && value <= maxInclusive ? "pass" : "fail";
  return { key, label, result, howToConfirm };
}

function ageCheck(birthDate: string, asOfISO: string, min: number, max: number): CheckOutcome {
  const age = calcAge(birthDate, asOfISO);
  return {
    key: "age",
    label: `나이 ${min}~${max}세`,
    result: age >= min && age <= max ? "pass" : "fail",
  };
}

/**
 * 앱의 판정 질문으로는 알 수 없어서 사용자가 결과 화면에서 직접 답하는 조건.
 *
 * 답이 없으면 'unknown' 으로 남는다 — 예전처럼 result 를 unknown 으로 박아 두는
 * 것과 같은 상태다. 답이 있으면 judge 로 pass/fail 을 낸다. 어느 쪽이든 ask 를
 * 함께 실어 보내 결과 화면이 입력 칸을 그리고 이미 답한 값도 고칠 수 있게 한다.
 */
function declaredCheck(
  p: EligibilityProfile,
  key: string,
  label: string,
  ask: DeclarableInput,
  judge: (value: DeclaredValue) => boolean,
  howToConfirm?: string
): CheckOutcome {
  const value = p.selfDeclared?.[key];
  const result: CheckResult = value === undefined || value === "" ? "unknown" : judge(value) ? "pass" : "fail";
  return { key, label, result, howToConfirm, ask };
}

/** 금액 조건. 값은 원 단위로 저장된다. */
function declaredMoney(
  p: EligibilityProfile,
  key: string,
  label: string,
  prompt: string,
  judge: (won: number) => boolean,
  howToConfirm?: string
): CheckOutcome {
  return declaredCheck(p, key, label, { kind: "money", prompt }, (v) => typeof v === "number" && judge(v), howToConfirm);
}

/** 예/아니오 조건. 기본은 '예' 여야 통과다. */
function declaredYesNo(
  p: EligibilityProfile,
  key: string,
  label: string,
  prompt: string,
  howToConfirm?: string,
  requireTrue = true
): CheckOutcome {
  return declaredCheck(p, key, label, { kind: "yesno", prompt }, (v) => v === requireTrue, howToConfirm);
}

/** 날짜 조건(주로 전입일). 값은 YYYY-MM-DD 다. */
function declaredDate(
  p: EligibilityProfile,
  key: string,
  label: string,
  prompt: string,
  judge: (iso: string) => boolean,
  years: number[],
  howToConfirm?: string
): CheckOutcome {
  return declaredCheck(
    p,
    key,
    label,
    { kind: "date", prompt, years },
    (v) => typeof v === "string" && v !== "" && judge(v),
    howToConfirm
  );
}

/** 전입일 질문이 고를 수 있는 연도. 최근 것이 위로 오게 내림차순이다. */
const MOVE_IN_YEARS = [2026, 2025, 2024, 2023, 2022];

type RuleFn = (profile: EligibilityProfile, asOfISO: string) => CheckOutcome[];

const moland: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ownCeiling = medianIncomeCeiling(householdSize, 0.6);
  const originCeiling = medianIncomeCeiling(householdSize, 1.0);

  const checks: CheckOutcome[] = [
    ageCheck(p.birthDate, asOf, 19, 34),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    boolCheck(
      "canRegisterResidence",
      "전입신고 가능",
      p.canRegisterResidence,
      true,
      "임대차계약서상 주소로 전입신고가 가능한지 확인하세요."
    ),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `본인 가구 소득 중위소득 60% 이하 (월 ${ownCeiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ownCeiling,
      "정부24·복지로에서 소득인정액 모의계산으로 확인하세요."
    ),
    boolCheck(
      "receivingOtherRentSupport",
      "다른 월세·주거비 지원 중복 수급 아님",
      p.receivingOtherRentSupport,
      false
    ),
  ];

  if (p.useOriginHousehold !== false) {
    checks.push(
      maxCeilingCheck(
        "originHouseholdIncome",
        `원가구 소득 중위소득 100% 이하 (월 ${originCeiling.toLocaleString()}원 이하)`,
        p.originHouseholdMonthlyIncome,
        originCeiling,
        "30세 이상, 혼인(이혼), 미혼부·모, 또는 독립생계가 인정되면 원가구 소득 기준이 적용되지 않을 수 있습니다. 정확한 예외 인정 여부는 주민센터에 문의하세요."
      )
    );
  }

  return checks;
};

const iksan: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const lowerCeiling = medianIncomeCeiling(householdSize, 0.6);
  const upperCeiling = medianIncomeCeiling(householdSize, 1.3);

  return [
    ageCheck(p.birthDate, asOf, 19, 34),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    rangeCheck(
      "ownHouseholdIncomeBand",
      `본인 가구 소득 중위소득 60% 초과 130% 이하 (월 ${(lowerCeiling + 1).toLocaleString()}~${upperCeiling.toLocaleString()}원)`,
      p.ownHouseholdMonthlyIncome,
      lowerCeiling,
      upperCeiling,
      "국토교통부 청년월세 지원에서 소득 기준 초과로 대상이 안 된 경우 이 구간에 해당할 가능성이 높습니다."
    ),
    boolCheck(
      "assetsUnder107M",
      "재산 가액 1억 700만원 이하",
      p.assetsUnder107M,
      true,
      "사회보장정보시스템 재산 조사 결과는 행정복지센터 방문 신청 시 확인됩니다."
    ),
    boolCheck(
      "receivingOtherRentSupport",
      "다른 월세·주거비 지원 중복 수급 아님",
      p.receivingOtherRentSupport,
      false
    ),
  ];
};

const jeonbukSettlement: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    { key: "age", label: "나이 18~39세", result: (() => {
      const age = calcAge(p.birthDate, asOf);
      return age >= 18 && age <= 39 ? "pass" : "fail";
    })() as CheckResult },
    boolCheck("jeonbukResidentOverOneYear", "전북특별자치도 1년 이상 거주", p.jeonbukResidentOverOneYear, true),
    boolCheck(
      "employedInTargetSectorOver3Months",
      "농업·임업·어업·중소기업(정규직)·문화예술·연구소기업(정규직)에 3개월 이상 재직",
      p.employedInTargetSectorOver3Months,
      true,
      "재직증명서·고용보험 가입이력으로 확인 가능합니다."
    ),
    maxCeilingCheck(
      "householdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

const iksanMovingCost: RuleFn = (p, asOf) => [ageCheck(p.birthDate, asOf, 18, 39)];

const youthHousingBenefitSplit: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const originCeiling = medianIncomeCeiling(householdSize, 0.48);

  return [
    ageCheck(p.birthDate, asOf, 19, 29),
    boolCheck(
      "livesApartFromParents",
      "부모와 다른 시·군·구에 거주 (별도 거주로 근사 판정)",
      p.livesApartFromParents,
      true,
      "부모님 주민등록상 주소지와 본인 주소지가 서로 다른 시·군·구인지 확인하세요."
    ),
    maxCeilingCheck(
      "originHouseholdIncome",
      `원가구 소득 중위소득 48% 이하 (월 ${originCeiling.toLocaleString()}원 이하)`,
      p.originHouseholdMonthlyIncome,
      originCeiling,
      "행정복지센터에서 부모 가구 소득인정액을 확인하세요."
    ),
  ];
};

/**
 * 전세보증금반환보증 보증료 지원.
 *
 * 나이 요건이 없다 — 정부24 안내와 온통청년 등록 모두 연령 제한을 두지 않는다.
 * '청년'은 자격이 아니라 소득 상한(연 5천/6천/7.5천만원)을 가르는 구분이다.
 *
 * 나머지 핵심 요건(보증 가입 여부·보증금 3억원 이하·연소득)은 계약 화면이
 * 입력받지 않는다. 지어내지 않고 '확인 필요'로 남긴다 — 그래야 카드가
 * '예상적용'으로 잘못 확정되지 않는다 (PRD F2-1).
 */
const jeonseGuaranteeFee: RuleFn = (p) => [
  boolCheck("hasNoHouse", "무주택 임차인", p.hasNoHouse, true),
  boolCheck("isContractHolder", "임대차계약 명의자 본인", p.isContractHolder, true),
  declaredYesNo(
    p,
    "guaranteeEnrolled",
    "전세보증금반환보증 가입 및 보증료 납부",
    "전세보증금반환보증(HUG·HF·SGI)에 가입하고 보증료를 냈나요?",
    "보증서와 보증료 납부 증빙(영수증·납부확인서)으로 확인하세요.",
  ),
  declaredMoney(
    p,
    "depositUnder300M",
    "임차보증금 3억원 이하",
    "임차보증금이 얼마인가요?",
    (won) => won <= 300_000_000,
    "전세 계약서의 보증금을 확인하세요.",
  ),
  declaredMoney(
    p,
    "annualIncomeCeiling",
    "연소득 기준 (청년 5천만원 · 청년외 6천만원 · 신혼부부 7.5천만원 이하)",
    "본인 연소득이 얼마인가요?",
    (won) => won <= 50_000_000,
    "국세청 소득금액증명 또는 건강보험 자격득실확인서로 확인하세요. 여기서는 청년 기준 5천만원으로 봅니다 — 신혼부부(7.5천만원)·청년외(6천만원)는 공고에서 확인하세요.",
  ),
];

/**
 * 서울 청년 부동산 중개보수 및 이사비 지원사업.
 *
 * 계산 가능한 조건(무주택·가구소득)만 판정한다. 원문에 있는 나머지 두 요건은
 * 이 앱의 입력으로 확인할 수 없어 '확인 필요'로 남긴다 — 지어내지 않는다:
 *  - "2024-01-01 이후 서울 전입/이사 + 전입신고" — 전입일자를 입력받지 않는다.
 *  - "거래금액(임차보증금+월세×100) 2억원 이하" — 판정 함수가 EligibilityProfile
 *    만 받고 ListingInput(계약 정보)을 안 받아 계산할 수 없다.
 */
const seoulMovingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택 임차가구", p.hasNoHouse, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredDate(
      p,
      "movedInAfter2024",
      "2024-01-01 이후 서울 전입 또는 서울 내 이사 후 전입신고",
      "전입신고일이 언제인가요?",
      (iso) => iso >= "2024-01-01",
      MOVE_IN_YEARS,
      "주민등록등본의 전입신고일을 확인하세요.",
    ),
    declaredMoney(
      p,
      "dealAmountUnder200M",
      "거래금액(임차보증금 + 월세액×100) 2억원 이하",
      "거래금액(임차보증금 + 월세액×100)이 얼마인가요?",
      (won) => won <= 200_000_000,
      "계약서의 보증금과 월세액으로 계산하세요.",
    ),
  ];
};

/**
 * 울산 청년가구 주거비 지원사업.
 *
 * '미혼 1인가구 세대주'(예외 규정 포함)는 이 앱이 세대 구성을 입력받지 않아
 * 판정하지 못한다 — '확인 필요'로 남긴다. 임차보증금 1억원·월세 50만원 이하
 * 요건도 ListingInput 이 필요해 여기서 계산하지 않는다(policies.json notes 참고).
 */
const ulsanYouthHouseholdHousingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    boolCheck(
      "receivingOtherRentSupport",
      "다른 월세·주거비 지원(국비 청년월세·울산 청년 주택임차보증금 이자지원 등) 중복 수급 아님",
      p.receivingOtherRentSupport,
      false
    ),
    declaredYesNo(
      p,
      "unmarriedSingleHouseholdHead",
      "미혼 청년 1인가구 세대주 (예외: 39세 이하 형제자매만 세대원인 경우 포함)",
      "미혼 1인가구 세대주인가요? (39세 이하 형제자매만 세대원인 경우도 예)",
      "가족관계증명서·주민등록등본으로 확인하세요.",
    ),
  ];
};

/**
 * 인천형 청년월세 지원(35~39세).
 *
 * moland(국비 청년월세, 19~34세)와 지원내용·소득재산기준이 완전히 같아 나이
 * 구간만 바꿔 재사용한다 — 로직을 복제해 어긋날 여지를 없앤다.
 */
const incheonYouthRent35to39: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ownCeiling = medianIncomeCeiling(householdSize, 0.6);
  const originCeiling = medianIncomeCeiling(householdSize, 1.0);

  const checks: CheckOutcome[] = [
    ageCheck(p.birthDate, asOf, 35, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    boolCheck(
      "canRegisterResidence",
      "전입신고 가능",
      p.canRegisterResidence,
      true,
      "임대차계약서상 주소로 전입신고가 가능한지 확인하세요."
    ),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `본인 가구 소득 중위소득 60% 이하 (월 ${ownCeiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ownCeiling,
      "정부24·복지로에서 소득인정액 모의계산으로 확인하세요."
    ),
    boolCheck(
      "receivingOtherRentSupport",
      "다른 월세·주거비 지원 중복 수급 아님",
      p.receivingOtherRentSupport,
      false
    ),
  ];

  if (p.useOriginHousehold !== false) {
    checks.push(
      maxCeilingCheck(
        "originHouseholdIncome",
        `원가구 소득 중위소득 100% 이하 (월 ${originCeiling.toLocaleString()}원 이하)`,
        p.originHouseholdMonthlyIncome,
        originCeiling,
        "30세 이상, 혼인(이혼), 미혼부·모, 또는 독립생계가 인정되면 원가구 소득 기준이 적용되지 않을 수 있습니다. 정확한 예외 인정 여부는 주민센터에 문의하세요."
      )
    );
  }

  return checks;
};

/**
 * 인천 천원 복비(주택 중개보수 지원).
 *
 * 임차보증금 1억원 이하·2년 이상 계약 여부는 ListingInput 이 필요해 이 함수가
 * 판정하지 못한다 — '확인 필요'로 남긴다(policies.json notes 참고).
 */
const incheonBrokerageFee: RuleFn = (p, asOf) => [
  ageCheck(p.birthDate, asOf, 18, 39),
  boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
  boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
  declaredMoney(
    p,
    "depositUnder100M",
    "임차보증금 1억원 이하, 2년 이상 임대차 계약(2026-01-01 이후 체결)",
    "임차보증금이 얼마인가요?",
    (won) => won <= 100_000_000,
    "보증금과 함께 계약기간(2년 이상)·계약일(2026-01-01 이후)도 계약서에서 확인하세요 — 금액만으로는 판정하지 않습니다.",
  ),
];

/**
 * 제주청년 희망충전 월세지원(35~39세).
 *
 * 인천형(35~39세)과 달리 원가구 소득 요건이 원문에 없다 — 본인 가구 소득
 * 중위60%·재산 1억2,200만원 이하만 있다. 재산 요건은 EligibilityProfile에
 * 맞는 문턱값이 없어(assetsUnder107M은 익산 전용) 판정하지 않는다.
 */
const jejuYouthRent35to39: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ownCeiling = medianIncomeCeiling(householdSize, 0.6);

  return [
    ageCheck(p.birthDate, asOf, 35, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 60% 이하 (월 ${ownCeiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ownCeiling
    ),
    declaredMoney(
      p,
      "assetsUnder122M",
      "재산 1억 2,200만원 이하",
      "재산이 얼마인가요?",
      (won) => won <= 122_000_000,
      "건물·토지·자동차·금융재산 합계입니다. 최종 확인은 사회보장정보시스템 재산 조사로 이뤄집니다.",
    ),
  ];
};

/**
 * 제주 청년 및 주거취약계층 주택 중개수수료 지원사업.
 *
 * 3억원 이하 주택 매매·임대차 계약 여부는 ListingInput 이 필요해 판정하지
 * 못한다 — '확인 필요'로 남긴다(policies.json notes 참고).
 */
const jejuBrokerageFee: RuleFn = (p, asOf) => [
  ageCheck(p.birthDate, asOf, 19, 39),
  boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
  boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
  declaredMoney(
    p,
    "dealAmountUnder300M",
    "3억원 이하 주택 매매·임대차 계약 (2년 1회, 최대 3회)",
    "계약 거래금액이 얼마인가요?",
    (won) => won <= 300_000_000,
    "계약서의 거래금액을 확인하세요. 지원 횟수(2년 1회·최대 3회)는 따로 확인이 필요합니다.",
  ),
];

/**
 * 제주 청년 이사비 지원사업.
 *
 * 상반기(2026.02.03~05.08)만 등록했다 — 하반기는 '2026.09월(예정)'이라고만
 * 있고 정확한 날짜가 없다(policies.json notes 참고).
 */
const jejuMovingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.8);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 180% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 부산청년 중개보수 및 이사비 지원.
 *
 * 거래금액(1.5억원 이하)·부모 소유 주택 임차 제외는 ListingInput 이 필요하거나
 * 이 앱이 입력받지 않는 조건이라 판정하지 못한다(policies.json notes 참고).
 */
const busanBrokerageMovingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.2);

  return [
    ageCheck(p.birthDate, asOf, 18, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 120% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredMoney(
      p,
      "dealAmountUnder150M",
      "거래금액(임차보증금 + 월세액×100) 1억 5,000만원 이하",
      "거래금액(임차보증금 + 월세액×100)이 얼마인가요?",
      (won) => won <= 150_000_000,
      "계약서의 보증금과 월세액으로 계산하세요.",
    ),
  ];
};

/**
 * 용인청년 중개보수 및 이사비 지원사업.
 *
 * 전입일자 요건(2026.1.1~6.30 전입/이사)·거래금액(2억원 이하)은 서울 이사비
 * 지원사업과 같은 이유로 판정하지 못한다(policies.json notes 참고). 원문에
 * '부모와 별도 거주'가 명시돼 있지 않아 넣지 않았다.
 */
const yonginBrokerageMovingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.8);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 180% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredDate(
      p,
      "movedInFirstHalf2026",
      "2026.1.1~6.30 용인시로 전입 또는 용인시 내 이사 후 전입신고 완료",
      "전입신고일이 언제인가요?",
      (iso) => iso >= "2026-01-01" && iso <= "2026-06-30",
      MOVE_IN_YEARS,
      "주민등록등본의 전입신고일을 확인하세요.",
    ),
    declaredMoney(
      p,
      "dealAmountUnder200M",
      "전·월세 보증금 2억원 이하",
      "전·월세 보증금이 얼마인가요?",
      (won) => won <= 200_000_000,
      "계약서의 보증금을 확인하세요.",
    ),
  ];
};

/**
 * 세종 청년 주거임대료 지원사업.
 *
 * 재산 1억2,200만원 이하는 EligibilityProfile에 맞는 문턱값이 없어 판정하지
 * 않는다(policies.json notes 참고).
 */
const sejongYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredMoney(
      p,
      "assetsUnder122M",
      "재산 1억 2,200만원 이하",
      "재산이 얼마인가요?",
      (won) => won <= 122_000_000,
      "건물·토지·자동차·금융재산 합계입니다. 최종 확인은 사회보장정보시스템 재산 조사로 이뤄집니다.",
    ),
  ];
};

/**
 * 인천 중구 청년 이사비 지원사업 / 광주 서구 천원 복비.
 *
 * 소득 기준이 원문에 없고, 거래금액 조건은 ListingInput 이 필요해 판정하지
 * 못한다(policies.json notes 참고) — 인천 천원 복비와 같은 형태의 최소 체크.
 */
const districtMovingCostOrBrokerageFee: RuleFn = (p, asOf) => [
  ageCheck(p.birthDate, asOf, 19, 39),
  boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
  boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
];

/**
 * 인천 동구·제물포구 청년 웰컴페이(이사비) 지원사업 — 조건이 동일해 공유한다.
 *
 * 2026-07-01 인천형 행정체제 개편으로 동구가 제물포구로 재편됐다
 * (policies.json의 incheon-jemulpogu-welcome-pay notes 참고). 전입일자
 * (2025-11-01 이후)는 ListingInput/EligibilityProfile 어디에도 없어
 * 판정하지 못한다 — '확인 필요'로 남긴다.
 */
const incheonDongguOrJemulpogu: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredDate(
      p,
      "movedInAfter20251101",
      "2025-11-01 이후 동구 전입 또는 관내 이사 후 전입신고",
      "전입신고일이 언제인가요?",
      (iso) => iso >= "2025-11-01",
      MOVE_IN_YEARS,
      "주민등록등본의 전입신고일을 확인하세요.",
    ),
  ];
};

/**
 * 인천 영종구 청년 이사비 지원사업.
 *
 * 중구·동구와 같은 형태에 가구 소득 중위120% 이하 조건만 다르다.
 */
const incheonYeongjonggu: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.2);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 120% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 평택시 청년 월세 지원.
 *
 * '1인가구'는 householdSize===1로 직접 판정한다. 임차보증금·월세 상한은
 * ListingInput 이 필요해 판정하지 않는다(policies.json notes 참고).
 */
const pyeongtaekYouthRent: RuleFn = (p, asOf) => {
  const ceiling = medianIncomeCeiling(1, 1.2);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    {
      key: "singleHousehold",
      label: "1인가구",
      result: p.householdSize === "unknown" ? "unknown" : p.householdSize === 1 ? "pass" : "fail",
    },
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 120% 이하 (월 ${ceiling.toLocaleString()}원 이하, 1인가구 기준)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 대전 청년 월세 지원사업.
 *
 * 원문에 '부모와 별도 거주' 요건이 명시돼 있지 않아 넣지 않았다(policies.json
 * notes 참고). 국비 청년월세(moland)와 중복 신청이 명시적으로 금지돼 있고
 * 소득 구간(120%)이 moland(60%이하)와 겹쳐 exclusiveGroup을 공유시켰다(구미형과
 * 같은 이유).
 */
const daejeonYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.2);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 120% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/** 음성군 청년월세 지원사업. */
const eumseongYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 구미형 청년월세 지원사업.
 *
 * 재산 1억 2,200만원 이하 요건은 세종과 같은 패턴 — 이 앱은 재산을 입력받지
 * 않아 항상 unknown 리터럴로 남긴다. 임대차계약 명의자 본인 요건은 원문
 * 공고문에 명시돼 있지 않아 넣지 않았다(policies.json notes 참고).
 */
const gumiYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.2);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 120% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredMoney(
      p,
      "assetsUnder122M",
      "재산 1억 2,200만원 이하",
      "재산이 얼마인가요?",
      (won) => won <= 122_000_000,
      "건물·토지·자동차·금융재산 합계입니다. 최종 확인은 사회보장정보시스템 재산 조사로 이뤄집니다.",
    ),
  ];
};

/**
 * 고령군 청년 월세 주거비 지원사업.
 *
 * 원문은 "청년 1인가구 또는 청년 신혼부부"를 대상으로 하지만, 이 앱은 혼인
 * 여부를 입력받지 않아 신혼부부(2인 이상 가구)는 판정하지 못한다 — 1인가구
 * 요건만 householdSize로 확인하고, 실제로는 자격이 되는 신혼부부 가구가
 * '해당없음'으로 잘못 분류될 수 있다는 한계를 그대로 남긴다.
 */
const goryeongYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.8);

  return [
    ageCheck(p.birthDate, asOf, 18, 45),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    {
      key: "singleHousehold",
      label: "청년 1인가구 (신혼부부는 이 앱이 혼인 여부를 안 물어 판정 못 함)",
      result: p.householdSize === "unknown" ? "unknown" : p.householdSize === 1 ? "pass" : "fail",
    },
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 180% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 울릉섬 청년 주거비 지원사업.
 *
 * 원문은 "무주택 1인 청년가구 및 신혼부부"를 대상으로 하지만, 이 앱은 혼인
 * 여부를 입력받지 않아 신혼부부(2인 이상 가구)는 판정하지 못한다 — 고령군과
 * 같은 처리(1인가구 요건만 확인). "2026.1.1 이전 전입신고"는 전입일자를
 * 입력받지 않아 unknown으로 남긴다.
 */
const ulleungYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 49),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    {
      key: "singleHousehold",
      label: "청년 1인가구 (신혼부부는 이 앱이 혼인 여부를 안 물어 판정 못 함)",
      result: p.householdSize === "unknown" ? "unknown" : p.householdSize === 1 ? "pass" : "fail",
    },
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredDate(
      p,
      "movedInBeforeJan2026",
      "2026-01-01 이전 울릉군 전입신고",
      "전입신고일이 언제인가요?",
      (iso) => iso < "2026-01-01",
      MOVE_IN_YEARS,
      "주민등록등본의 전입신고일을 확인하세요.",
    ),
  ];
};

/**
 * 강진군 청년 취업자 주거비 지원사업.
 *
 * 원문 ③(노동) 요건은 "최근 6개월 이내 3개월 이상 노동 중" 또는 "사업자(전남 소재,
 * 개업 6개월 이전+3개월 이상 운영)"인데, 이 앱은 재직/재학/미취업만 물어 재직 기간·
 * 사업자 여부는 판정하지 못한다 — isStudentOrEmployed === "employed"만 근사 pass로,
 * 나머지(재학·미취업)는 fail로 처리한다. ④(주거) 전세 대출금 5천만원 이상 또는
 * 월세 60만원 이하 요건은 이 앱이 임차료 금액을 입력받지 않아 unknown으로 남긴다.
 */
const gangjinYouthWorkerRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 18, 45),
    {
      key: "employedOrBusinessOwner",
      label: "노동자(최근 6개월 내 3개월 이상 재직) 또는 사업자(전남 소재, 개업 6개월 이전+3개월 이상 운영)",
      result: p.isStudentOrEmployed === "unknown" ? "unknown" : p.isStudentOrEmployed === "employed" ? "pass" : "fail",
      howToConfirm: "재직증명서 또는 사업자등록증명원으로 재직·운영 기간을 확인하세요. 이 앱은 재직 기간이나 사업자 등록 여부는 정확히 묻지 않습니다.",
    },
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    declaredYesNo(
      p,
      "rentOrJeonseThreshold",
      "전세(대출금 5천만원 이상) 또는 월세(60만원 이하) 거주, 강진군 소재 주택 임차",
      "강진군 주택에 전세(대출금 5천만원 이상) 또는 월세(60만원 이하)로 살고 있나요?",
      "임대차계약서로 전세 대출금 또는 월세 금액을 확인하세요.",
    ),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 150% 이하 (월 ${ceiling.toLocaleString()}원 이하)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
  ];
};

/**
 * 괴산군 청년취업자 및 청년농업인 주거비 지원.
 *
 * '관내 기업 취업 또는 농업경영체 등록 5년 이내'는 이 앱이 취업·창업 이력을
 * 안 물어 판정하지 못한다(policies.json notes 참고).
 */
const goesanYouthWorkerFarmerHousingCost: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const ceiling = medianIncomeCeiling(householdSize, 1.8);

  return [
    ageCheck(p.birthDate, asOf, 19, 49),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    maxCeilingCheck(
      "ownHouseholdIncome",
      `가구 소득 중위소득 180% 미만 (월 ${ceiling.toLocaleString()}원 미만)`,
      p.ownHouseholdMonthlyIncome,
      ceiling
    ),
    declaredYesNo(
      p,
      "employedOrFarmingInGoesanUnder5Years",
      "괴산군 관내 기업 취업 또는 농업경영체 등록 5년 이내",
      "괴산군 관내 기업 취업 또는 농업경영체 등록을 한 지 5년 이내인가요?",
      "재직증명서·농업경영체등록확인서로 확인하세요.",
    ),
  ];
};

/** 하동형 청년 주거비 지원사업. */
const hadongYouthHousingCost: RuleFn = (p, asOf) => [
  ageCheck(p.birthDate, asOf, 19, 45),
  boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
];

/**
 * 산청군 청년월세 지원사업 (경상남도).
 *
 * 국비 청년월세(중위60% 이하)가 못 미치는 60%초과~150%이하 구간만 지원한다
 * — 이 하한 조건은 rangeCheck로 판정한다(iksan-youth-rent-support와 같은 패턴).
 */
const sancheongYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const lowerCeiling = medianIncomeCeiling(householdSize, 0.6);
  const upperCeiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 49),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    rangeCheck(
      "ownHouseholdIncomeBand",
      `가구 소득 중위소득 60% 초과 150% 이하 (월 ${(lowerCeiling + 1).toLocaleString()}~${upperCeiling.toLocaleString()}원)`,
      p.ownHouseholdMonthlyIncome,
      lowerCeiling,
      upperCeiling
    ),
  ];
};

/**
 * 창원시 청년월세 지원사업 (경상남도).
 *
 * 산청군·합천군과 같은 프레임(중위60%초과~150%이하)이지만 나이가 19~39세로
 * 더 좁다. '세대주가 청년인 가구' 요건은 세대 구성을 입력받지 않아 unknown
 * 리터럴로 남긴다(울산 청년가구 주거비 지원사업과 같은 처리).
 */
const changwonYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const lowerCeiling = medianIncomeCeiling(householdSize, 0.6);
  const upperCeiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 39),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    rangeCheck(
      "ownHouseholdIncomeBand",
      `가구 소득 중위소득 60% 초과 150% 이하 (월 ${(lowerCeiling + 1).toLocaleString()}~${upperCeiling.toLocaleString()}원)`,
      p.ownHouseholdMonthlyIncome,
      lowerCeiling,
      upperCeiling
    ),
    declaredYesNo(
      p,
      "householdHead",
      "세대주가 청년 본인",
      "세대주가 본인인가요?",
      "주민등록등본으로 세대주 여부를 확인하세요.",
    ),
  ];
};

/**
 * 남해군 청년 월세 지원사업 (경상남도).
 *
 * 산청군·합천군·창원시와 같은 프레임(중위60%초과~150%이하)이지만 나이는
 * 19~45세. '본인 명의 임대차 계약' + '무주택 세대주'를 둘 다 요구한다 —
 * 세대주 여부는 세대 구성을 입력받지 않아 unknown으로 남긴다(창원시와 같은 처리).
 */
const namhaeYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const lowerCeiling = medianIncomeCeiling(householdSize, 0.6);
  const upperCeiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 19, 45),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("livesApartFromParents", "부모와 별도 거주", p.livesApartFromParents, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    rangeCheck(
      "ownHouseholdIncomeBand",
      `가구 소득 중위소득 60% 초과 150% 이하 (월 ${(lowerCeiling + 1).toLocaleString()}~${upperCeiling.toLocaleString()}원)`,
      p.ownHouseholdMonthlyIncome,
      lowerCeiling,
      upperCeiling
    ),
    declaredYesNo(
      p,
      "householdHead",
      "무주택 세대주가 청년 본인",
      "무주택 세대주가 본인인가요?",
      "주민등록등본으로 세대주 여부를 확인하세요.",
    ),
  ];
};

/** 합천군 청년 월세 지원사업 (경상남도) — 산청군과 같은 프레임, 나이만 18세부터. */
const hapcheonYouthRent: RuleFn = (p, asOf) => {
  const householdSize = p.householdSize === "unknown" ? 1 : p.householdSize;
  const lowerCeiling = medianIncomeCeiling(householdSize, 0.6);
  const upperCeiling = medianIncomeCeiling(householdSize, 1.5);

  return [
    ageCheck(p.birthDate, asOf, 18, 49),
    boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
    boolCheck("isContractHolder", "임대차계약 명의가 본인", p.isContractHolder, true),
    rangeCheck(
      "ownHouseholdIncomeBand",
      `가구 소득 중위소득 60% 초과 150% 이하 (월 ${(lowerCeiling + 1).toLocaleString()}~${upperCeiling.toLocaleString()}원)`,
      p.ownHouseholdMonthlyIncome,
      lowerCeiling,
      upperCeiling
    ),
  ];
};

/**
 * 통영시 관외 청년 거주 정착 지원 사업.
 *
 * '타 시군구 6개월 이상 거주 후 2025-09-01 이후 취·창업 전입'은 전입일자·
 * 취업이력을 안 물어 판정하지 못한다(policies.json notes 참고).
 */
const tongyeongYouthSettlement: RuleFn = (p, asOf) => [
  ageCheck(p.birthDate, asOf, 18, 45),
  boolCheck("hasNoHouse", "무주택자", p.hasNoHouse, true),
  {
    key: "singleHousehold",
    label: "1인가구",
    result: p.householdSize === "unknown" ? "unknown" : p.householdSize === 1 ? "pass" : "fail",
  },
  declaredYesNo(
    p,
    "movedInFromElsewhereAfter20250901",
    "타 시군구 6개월 이상 거주 후 2025-09-01 이후 취·창업으로 통영시 전입",
    "타 시군구에 6개월 이상 살다가 2025-09-01 이후 취·창업으로 통영시에 전입했나요?",
    "주민등록등본·재직증명서로 확인하세요.",
  ),
];

export const POLICY_RULES: Record<string, RuleFn> = {
  "moland-youth-rent-support": moland,
  "iksan-youth-rent-support": iksan,
  "jeonbuk-youth-settlement-support": jeonbukSettlement,
  "iksan-newcomer-moving-cost-support": iksanMovingCost,
  "youth-housing-benefit-split-payment": youthHousingBenefitSplit,
  "jeonse-return-guarantee-fee-subsidy": jeonseGuaranteeFee,
  "seoul-youth-moving-cost-support": seoulMovingCost,
  "ulsan-youth-household-housing-cost-support": ulsanYouthHouseholdHousingCost,
  "incheon-youth-monthly-rent-support-35to39": incheonYouthRent35to39,
  "incheon-brokerage-fee-1000won": incheonBrokerageFee,
  "jeju-youth-hope-charge-monthly-rent-35to39": jejuYouthRent35to39,
  "jeju-brokerage-fee-support": jejuBrokerageFee,
  "jeju-youth-moving-cost-support": jejuMovingCost,
  "busan-youth-brokerage-moving-cost-support": busanBrokerageMovingCost,
  "sejong-youth-rent-support": sejongYouthRent,
  "incheon-junggu-moving-cost-support": districtMovingCostOrBrokerageFee,
  "incheon-donggu-welcome-pay": incheonDongguOrJemulpogu,
  "incheon-jemulpogu-welcome-pay": incheonDongguOrJemulpogu,
  "gwangju-seogu-brokerage-fee-1000won": districtMovingCostOrBrokerageFee,
  "incheon-yeongjonggu-moving-cost-support": incheonYeongjonggu,
  "pyeongtaek-youth-rent-support": pyeongtaekYouthRent,
  "daejeon-youth-rent-support": daejeonYouthRent,
  "eumseong-youth-rent-support": eumseongYouthRent,
  "gumi-youth-rent-support": gumiYouthRent,
  "goryeong-youth-rent-support": goryeongYouthRent,
  "ulleung-youth-rent-support": ulleungYouthRent,
  "gangjin-youth-worker-rent-support": gangjinYouthWorkerRent,
  "goesan-youth-worker-farmer-housing-cost-support": goesanYouthWorkerFarmerHousingCost,
  "hadong-youth-housing-cost-support": hadongYouthHousingCost,
  "sancheong-youth-rent-support": sancheongYouthRent,
  "namhae-youth-rent-support": namhaeYouthRent,
  "hapcheon-youth-rent-support": hapcheonYouthRent,
  "tongyeong-youth-settlement-support": tongyeongYouthSettlement,
  "changwon-youth-rent-support": changwonYouthRent,
  "yongin-brokerage-moving-cost-support": yonginBrokerageMovingCost,
};
