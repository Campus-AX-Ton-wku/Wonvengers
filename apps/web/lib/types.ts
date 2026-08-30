// 응답 값: 사용자가 판단할 수 없으면 "unknown"을 허용한다 (PRD F2-1).
export type Answer<T> = T | "unknown";

export type ContractType = "월세" | "연세";

// F1. 사용자가 입력하는 계약 조건
export interface ListingInput {
  region: string; // 시·군·구
  contractType: ContractType;
  deposit: number; // 보증금
  rentOrYearlyAmount: number; // 월세액 또는 연세 선납액
  managementFee: number; // 월 관리비
  oneTimeMoveCost: number; // 이사비 등 정책이 요구하는 일시 지출(F1-4), 없으면 0
  contractStartDate: string; // YYYY-MM-DD
  months: number; // 거주 예정 개월 수
  // F1-9. "예시 데이터"는 발표용 예시 매물을 불러왔다는 뜻이다 — 실제로 확인한
  // 출처가 아니므로 광고·중개사 안내·계약서와 섞지 않는다 (F1-11).
  sourceType: "부동산 광고" | "중개사 안내" | "계약서" | "예시 데이터";
  confirmedMatchesActualContract: boolean; // F1-10
  /** 예시 매물에서 불러온 입력이면 그 예시의 id. 직접 입력한 값이면 null. (F1-11) */
  exampleId?: string | null;
}

/**
 * F1-11. 발표용 예시 매물.
 *
 * sourceKind 와 verifiedAt 으로 "이게 실제 매물인지"를 화면에 그대로 드러낸다.
 * verifiedAt 이 null 이면 팀이 확인하기 전이므로 실제 매물이라고 표시할 수 없다.
 */
export interface ExampleListing {
  id: string;
  label: string;
  sourceKind: "가상 예시" | "실제 매물" | "실거래 사례";
  verifiedAt: string | null; // YYYY-MM-DD, null = 팀 확인 전
  note: string;
  listing: Pick<
    ListingInput,
    | "region"
    | "contractType"
    | "deposit"
    | "rentOrYearlyAmount"
    | "managementFee"
    | "oneTimeMoveCost"
    | "months"
  >;
}

// F2. 정책 판정용 공통 입력
export interface EligibilityProfile {
  birthDate: string; // YYYY-MM-DD
  isStudentOrEmployed: "student" | "employed" | "unemployed" | "unknown";
  livesApartFromParents: Answer<boolean>;
  canRegisterResidence: Answer<boolean>;
  hasNoHouse: Answer<boolean>; // 무주택 여부
  isContractHolder: Answer<boolean>; // 계약 명의자 본인 여부
  householdSize: Answer<number>; // 본인 가구원 수
  useOriginHousehold: Answer<boolean>; // 원가구 소득 산정 대상인지
  ownHouseholdMonthlyIncome: Answer<number>;
  originHouseholdMonthlyIncome: Answer<number>;
  assetsUnder107M: Answer<boolean>; // 익산시 재산 기준(1억 700만원 이하)
  isBasicLivelihoodRecipient: Answer<boolean>;
  isNearPovertyClass: Answer<boolean>;
  receivingOtherRentSupport: Answer<boolean>; // 다른 월세·주거비 지원 중복 수급 여부
  jeonbukResidentOverOneYear: Answer<boolean>;
  employedInTargetSectorOver3Months: Answer<boolean>; // 농업·임업·어업·중소기업정규직·문화예술·연구소기업정규직
}

export type RequiredInputKey = keyof EligibilityProfile;

export type PolicyStatus = "예상적용" | "조건충족시가능" | "대상아님" | "신청불가";

export type CheckResult = "pass" | "fail" | "unknown";

export interface CheckOutcome {
  key: string;
  label: string;
  result: CheckResult;
  howToConfirm?: string;
}

// rent_capped_monthly: min(월 상한, 실제 인정 월세) × 개월수 (예: 월세지원형)
// flat_monthly: 실제 월세와 무관하게 정액 × 개월수 (예: 정착지원금)
// lump_sum: min(총 상한, 실제 지출) 1회 지급
export type BenefitType = "rent_capped_monthly" | "flat_monthly" | "lump_sum";

/**
 * 1층(발견) 태그 판정에만 쓰는 필드. 2층 판정 규칙은 이걸 읽지 않는다.
 *
 * ageMin/ageMax/regions 는 policy-rules.ts 와 regionScope 에서 그대로 옮긴 값이다.
 * statuses / incomeBracketMax 가 null 이면 "모름"으로 취급해 '확인 필요' 태그가
 * 붙는다. 값을 추정해 채우지 말 것 (PRD F0-5).
 *
 * incomeBracketMin 만 예외로 null 을 '하한 조건 없음'으로 읽는다. 소득 상한은
 * 모든 청년 정책에 있지만 하한은 익산형 하나뿐이라, null 을 '모름'으로 읽으면
 * 나머지 정책 전부가 이유 없이 '확인 필요'가 된다.
 *
 * null 을 남기는 사유는 두 가지다:
 *  1. 공식 공고를 아직 확인하지 못했다.
 *  2. 확인은 했지만 1층 질문 4개로는 판정할 수 없다 — 본인이 아닌 원가구 소득으로
 *     심사하는 정책(청년 주거급여 분리지급)이 여기 해당한다. 원가구 가구원 수를
 *     모르면 본인 소득 구간만으로는 탈락시킬 수 없다.
 *
 * incomeBracketMin/Max 를 채울 때는 정책 소득 기준(1인 가구 기준)이 걸쳐 있는
 * 구간까지 통과시킨다. 경계 구간은 2층에서 실제 금액으로 정밀 판정한다.
 * 예) 중위 60% = 월 1,538,543원 -> 3번 구간(150~200만원)이 걸친 구간이므로,
 *     '60% 이하'면 Max=3, '60% 초과'면 Min=3 이다.
 *
 * 소득 하한이 있는 정책은 익산형 청년월세뿐이다(중위 60% 초과 ~ 130% 이하).
 * 국토부 사업에서 소득 초과로 탈락한 청년을 받는 사업이라, 하한을 빼먹으면
 * 저소득 청년 전원에게 '가능성 있음'이 잘못 표시된다.
 */
export interface PolicyDiscovery {
  ageMin: number;
  ageMax: number;
  regions: string[]; // region.ts 의 REGION_OPTIONS 값과 같은 어휘를 쓴다
  statuses: DiscoveryStatus[] | null;
  incomeBracketMin: number | null; // null = 하한 없음 또는 확인 전
  incomeBracketMax: number | null;
}

export interface PolicyMeta {
  id: string;
  discovery: PolicyDiscovery;
  name: string;
  agency: string;
  regionScope: string;
  applicationStart: string; // YYYY-MM-DD
  applicationEnd: string | null; // null = 상시(마감 없음)
  benefitType: BenefitType;
  benefitSummary: string; // 사람이 읽는 지원 형태 요약
  monthlyCap?: number; // 월 상한액
  maxMonths?: number; // 지급 가능 개월 수
  lumpSumCap?: number; // 일시 지급 상한액
  requiredInputs: RequiredInputKey[];
  exclusiveGroup: string[]; // 동시 합산 불가 그룹 id들
  sourceUrl: string;
  applyUrl: string;
  /**
   * 온통청년(정부 청년정책 DB)의 정책번호(plcyNo). null = 아직 매핑하지 않음.
   *
   * 화면에서는 쓰지 않는다. 정책 발굴 스크립트(scripts/fetch-youth-policies.mjs)가
   * "이 후보는 이미 앱에 있다"를 가려내는 데만 쓴다. 사용자에게 보여주는 출처는
   * sourceUrl(지역 공고 원문) 하나다.
   */
  youthPolicyNo: string | null;
  verifiedAt: string | null; // null = 팀 교차검수 전
  effectiveYear: number;
  notes: string;
}

export interface PolicyResult {
  policy: PolicyMeta;
  status: PolicyStatus;
  checks: CheckOutcome[];
  passedLabels: string[];
  failedLabels: string[];
  unknownLabels: string[];
  estimatedAmount: number; // 이 정책 단독 총 예상액 (월 상한 × 개월 등 반영)
}

export interface CombinationResult {
  includedPolicyIds: string[];
  totalAmount: number;
}

// 대출·보증료 지원 등 "현금 지원금"이 아닌 상품. 이자 절감액 등은 계산하지 않고 안내만 제공한다.
// 최대 지원 가능액(현금 지원 합계)에는 포함하지 않는다 — 성격이 다른 금액을 섞으면
// 실제보다 더 많이 받는 것처럼 보일 수 있기 때문이다.
export interface LoanProductMeta {
  id: string;
  name: string;
  agency: string;
  regionScope: string;
  productType: "loan_interest_subsidy" | "guarantee_fee_subsidy";
  summary: string;
  sourceUrl: string;
  applyUrl: string;
  verifiedAt: string | null;
  effectiveYear: number;
  notes: string;
}

export interface CalculationSummary {
  nominalTotalCost: number; // 명목 총 지출
  maxSupportAmount: number; // 최대 지원 가능액
  finalEstimatedHousingCost: number; // 최종 예상 주거비
  bestCombination: CombinationResult;
  results: PolicyResult[];
}

// ── 1층(발견) 전용 타입 ──

export type DiscoveryStatus = "대학생" | "재직" | "구직";

/** 1층 질문 4개에 대한 답. null 은 사용자가 '모름'을 선택했다는 뜻이다. */
export interface DiscoveryAnswers {
  /**
   * YYYY-MM-DD. 나이(숫자)가 아니라 생년월일을 저장한다 — 나이를 저장하면 시간이
   * 지나며 조용히 거짓이 된다. 만 39세로 저장된 사람이 반년 뒤에도 39세로 판정된다.
   * 2층(/eligibility)도 같은 값을 쓰므로 같은 질문을 두 번 하지 않아도 된다.
   */
  birthDate: string | null;
  region: string | null; // REGION_OPTIONS 의 value
  status: DiscoveryStatus | null;
  incomeBracket: number | null;
}

/**
 * 판정 코드(filter·discovery)가 보는 형태.
 *
 * tagPolicy 는 순수 함수라 오늘이 며칠인지 모른다. 생년월일을 그대로 넘기면
 * groupPolicies·answerSummary·candidateCount 까지 기준일 인자가 번진다.
 * 화면 경계에서 resolveAnswers 로 한 번만 나이로 바꿔 넘긴다.
 */
export type ResolvedAnswers = Omit<DiscoveryAnswers, "birthDate"> & { age: number | null };

export type DiscoveryTag = "가능성 있음" | "확인 필요" | "해당 없음";

export interface TagResult {
  tag: DiscoveryTag;
  failReasons: string[]; // '해당 없음'일 때 모든 탈락 이유
  unknownFields: string[]; // '확인 필요'일 때 모름으로 남은 항목 이름
}

export interface IncomeBracket {
  bracket: number;
  label: string;
}
