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
 * 익산 전입 지원 두 가지(전입세대 전입장려금 · 주소전입 학생 지원)가 같이 쓰는 조건.
 * 「익산시 인구증가시책 지원 조례」 [별표] 1 · 3호의 대상이 똑같이 '전입신고일 기준 1년
 * 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 사람'이다.
 *
 * 전입 이력은 앱 입력에 없어 결과 화면에서 직접 묻는다. 같은 키를 써서 한 번 답하면
 * 두 정책에 함께 반영된다. 예전 수혜 여부도 두 정책 모두 '기 지원받은 사실이 있으면 불가'다.
 */
function iksanMoveInChecks(p: EligibilityProfile): CheckOutcome[] {
  return [
    boolCheck(
      "canRegisterResidence",
      "익산시 주소로 전입신고",
      p.canRegisterResidence,
      true,
      "임대차계약서상 익산시 주소로 전입신고할 수 있는지 확인하세요."
    ),
    declaredYesNo(
      p,
      "livedOutsideIksan1YearBeforeMoveIn",
      "전입 전 1년 이상 다른 시·군·구에 주민등록",
      "익산시로 전입하기 전 1년 넘게 다른 시·군·구에 주민등록이 있었나요? (아직 전입 전이면 지금 주소 기준)",
      "주민등록초본의 주소 변동 이력으로 확인하세요."
    ),
    declaredYesNo(
      p,
      "receivedIksanMoveInSupportBefore",
      "예전에 익산시 전입 지원을 받은 적 없음",
      "예전에 익산시 전입장려금이나 주소전입 학생 지원을 받은 적이 있나요?",
      "재전입자 중 이미 지원받은 사람은 다시 받을 수 없어요.",
      false
    ),
  ];
}

/** 전입세대 전입장려금 — 조례 [별표] 1. 전입세대 지원 마). 나이 · 소득 · 재학 조건 없음. */
const iksanMoveInHousehold: RuleFn = (p) => iksanMoveInChecks(p);

/** 주소전입 학생 지원(대학 · 대학원생) — 조례 [별표] 3. 전입대학생 및 대학원생 지원. */
const iksanMoveInStudent: RuleFn = (p) => [
  ...iksanMoveInChecks(p),
  declaredYesNo(
    p,
    "attendsIksanUniversity",
    "익산시 소재 대학교 · 대학원 재학",
    "익산시에 있는 대학교나 대학원에 다니고 있나요?",
    "재학증명서로 확인하세요."
  ),
];

export const POLICY_RULES: Record<string, RuleFn> = {
  "moland-youth-rent-support": moland,
  "iksan-youth-rent-support": iksan,
  "jeonbuk-youth-settlement-support": jeonbukSettlement,
  "iksan-newcomer-moving-cost-support": iksanMovingCost,
  "youth-housing-benefit-split-payment": youthHousingBenefitSplit,
  "jeonse-return-guarantee-fee-subsidy": jeonseGuaranteeFee,
  "iksan-move-in-household-incentive": iksanMoveInHousehold,
  "iksan-move-in-student-support": iksanMoveInStudent,
};
