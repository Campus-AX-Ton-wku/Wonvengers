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
      "국토교통부 청년월세 한시특별지원에서 소득 기준 초과로 대상이 안 된 경우 이 구간에 해당할 가능성이 높습니다."
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

export const POLICY_RULES: Record<string, RuleFn> = {
  "moland-youth-rent-support": moland,
  "iksan-youth-rent-support": iksan,
  "jeonbuk-youth-settlement-support": jeonbukSettlement,
  "iksan-newcomer-moving-cost-support": iksanMovingCost,
  "youth-housing-benefit-split-payment": youthHousingBenefitSplit,
};
