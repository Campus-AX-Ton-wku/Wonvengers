import type { EligibilityProfile, ListingInput } from "../types";

export const TODAY = "2026-08-12";

/**
 * 국토부 청년월세(3/30~5/29)와 전북청년 지역정착(본모집 3/6~3/20 + 추가모집 3/30~4/10)의
 * 접수 기간이 겹치는 날. 두 사업은 TODAY 기준으로는 이미 접수가 끝나 '신청불가'가 되므로,
 * 판정 규칙 자체를 검증하는 테스트에서는 이 날짜를 기준일로 쓴다.
 */
export const OPEN_PERIOD_DAY = "2026-04-01";

export function makeListing(overrides: Partial<ListingInput> = {}): ListingInput {
  return {
    region: "전북특별자치도 익산시",
    contractType: "연세",
    deposit: 300000,
    rentOrYearlyAmount: 4800000, // 연세 480만원 -> 월 40만원 환산
    managementFee: 30000,
    oneTimeMoveCost: 0,
    contractStartDate: "2026-09-01",
    months: 12,
    sourceType: "중개사 안내",
    confirmedMatchesActualContract: true,
    ...overrides,
  };
}

// 국토부(60% 이하)·익산시(60~130%) 두 소득 밴드 사이 어디에도 딱 걸치지 않도록
// 각 테스트에서 ownHouseholdMonthlyIncome을 명시적으로 지정해 사용한다.
export function makeProfile(overrides: Partial<EligibilityProfile> = {}): EligibilityProfile {
  return {
    birthDate: "2003-08-12", // asOf 2026-08-12 기준 정확히 23세
    isStudentOrEmployed: "student",
    livesApartFromParents: true,
    canRegisterResidence: true,
    hasNoHouse: true,
    isContractHolder: true,
    householdSize: 1,
    useOriginHousehold: true,
    ownHouseholdMonthlyIncome: 1000000,
    originHouseholdMonthlyIncome: 1000000,
    assetsUnder107M: true,
    isBasicLivelihoodRecipient: false,
    isNearPovertyClass: false,
    receivingOtherRentSupport: false,
    jeonbukResidentOverOneYear: true,
    employedInTargetSectorOver3Months: true,
    ...overrides,
  };
}

/**
 * 그 나이가 되는 생년월일.
 *
 * 1월 1일생으로 잡으면 올해 생일이 이미 지났으므로 만 나이가 연도 차이와 정확히
 * 같다 — 픽스처가 오늘 날짜에 흔들리지 않는다. (나이를 숫자로 저장하지 않는
 * 이유는 lib/types.ts 의 DiscoveryAnswers.birthDate 주석 참고)
 */
export function birthDateForAge(age: number, today = new Date()): string {
  return `${today.getFullYear() - age}-01-01`;
}
