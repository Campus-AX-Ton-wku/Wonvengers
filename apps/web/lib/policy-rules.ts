import type { Answer, CheckOutcome, CheckResult, EligibilityProfile } from "./types";
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
  {
    key: "guaranteeEnrolled",
    label: "전세보증금반환보증 가입 및 보증료 납부",
    result: "unknown",
    howToConfirm:
      "HUG·HF·SGI 중 한 곳에 가입한 보증서와 보증료 납부 증빙이 있어야 합니다. 이 앱은 가입 여부를 입력받지 않습니다.",
  },
  {
    key: "depositUnder300M",
    label: "임차보증금 3억원 이하",
    result: "unknown",
    howToConfirm: "전세 계약서의 보증금을 확인하세요. 이 앱은 전세 계약을 입력받지 않습니다.",
  },
  {
    key: "annualIncomeCeiling",
    label: "연소득 기준 (청년 5천만원 · 청년외 6천만원 · 신혼부부 7.5천만원 이하)",
    result: "unknown",
    howToConfirm: "국세청 소득금액증명 또는 건강보험 자격득실확인서로 확인하세요.",
  },
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
    {
      key: "movedInAfter2024",
      label: "2024-01-01 이후 서울 전입 또는 서울 내 이사 후 전입신고",
      result: "unknown",
      howToConfirm: "전입신고일이 2024-01-01 이후인지 주민등록등본으로 확인하세요. 이 앱은 전입일자를 입력받지 않습니다.",
    },
    {
      key: "dealAmountUnder200M",
      label: "거래금액(임차보증금 + 월세액×100) 2억원 이하",
      result: "unknown",
      howToConfirm: "계약서의 보증금과 월세액으로 직접 계산하세요. 이 앱은 이 기준으로 판정하지 않습니다.",
    },
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
    {
      key: "unmarriedSingleHouseholdHead",
      label: "미혼 청년 1인가구 세대주 (예외: 39세 이하 형제자매만 세대원인 경우 포함)",
      result: "unknown",
      howToConfirm: "가족관계증명서·주민등록등본으로 확인하세요. 이 앱은 세대 구성을 입력받지 않습니다.",
    },
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
  {
    key: "depositUnder100M",
    label: "임차보증금 1억원 이하, 2년 이상 임대차 계약(2026-01-01 이후 체결)",
    result: "unknown",
    howToConfirm: "계약서의 보증금과 계약기간을 확인하세요. 이 앱은 계약 정보로 판정하지 않습니다.",
  },
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
};
