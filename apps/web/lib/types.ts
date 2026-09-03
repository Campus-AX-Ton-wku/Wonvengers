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
  confirmedMatchesActualContract: boolean; // F1-10
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
  /**
   * null = 나이 제한 없음. 확인 전이라는 뜻이 아니다.
   *
   * 온통청년 등록에 `sprtTrgtAgeLmtYn` 플래그가 따로 있는 항목이다. 전세보증금
   * 반환보증 보증료 지원이 여기 해당한다 — 전 연령을 지원하고, '청년'은 자격
   * 요건이 아니라 소득 상한(5천/6천/7.5천만원)을 가르는 구분이다. 이걸 만
   * 19~34세로 적어 넣으면 없는 제한을 만들어 대상자를 탈락시킨다.
   */
  ageMin: number | null;
  ageMax: number | null;
  regions: string[]; // region.ts 의 REGION_OPTIONS 값과 같은 어휘를 쓴다
  statuses: DiscoveryStatus[] | null;
  incomeBracketMin: number | null; // null = 하한 없음 또는 확인 전
  incomeBracketMax: number | null;
  /**
   * 이 정책이 인정하는 주거 형태. null = 주거 형태를 따지지 않는 정책.
   *
   * incomeBracketMin 과 같은 예외를 쓴다 — 주거 형태 제한이 있는 정책이 소수라,
   * null 을 '모름'으로 읽으면 나머지 전부가 이유 없이 '확인 필요'가 된다.
   * 이사비·정착지원금처럼 계약 형태와 무관한 사업이 여기 해당한다.
   *
   * 값이 있는 정책은 공고가 계약 형태를 요건으로 적은 경우다. 국토부·익산형
   * 청년월세는 월세 계약만, 보증금반환보증 보증료 지원은 전세 계약만 받는다.
   */
  housingTypes: HousingType[] | null;
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
  /**
   * lump_sum 정책의 2층 예상액을 무엇으로 계산하는가.
   *
   * "oneTimeMoveCost" — 계약 화면이 받는 일시 지출(이사비·중개보수) 기준.
   * "notCalculable"  — 2층이 그 지출을 입력받지 않는다. 예상액을 0 으로 둔다.
   *
   * 보증금반환보증 보증료 지원을 넣으면서 생긴 구분이다. lump_sum 이 하나뿐일
   * 때는 '일시 지출' 칸 하나로 충분했지만, 보증료는 이사비가 아니다. 이걸 그냥
   * 두면 이사비 30만원을 넣은 사람에게 보증료 지원 30만원이 붙어 최대 지원
   * 가능액이 부풀려진다. 값이 없으면 계산하지 않는다 — 금액을 넘겨 말하지
   * 않는 쪽이 안전하다.
   */
  lumpSumBasis?: "oneTimeMoveCost" | "notCalculable";
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
  /**
   * 보조금24(행안부 대한민국 공공서비스 정보)의 서비스ID. null = 그 소스에 없거나 매핑하지 않음.
   *
   * 온통청년과 마찬가지로 화면에는 쓰지 않는다. 신선도 감지
   * (scripts/check-policy-freshness.mjs)에서 3자 대조의 세 번째 축으로만 쓴다.
   *
   * 2026-08-30 확인: 익산 사업 2건(익산형 청년월세·전입 청년 이사비)은 보조금24에
   * 등록 자체가 없다. '청년 주거급여 분리지급'은 보조금24의
   * "주거급여 (맞춤형 급여)"와 사업 범위가 달라 일부러 매핑하지 않았다 —
   * 억지로 붙이면 매주 같은 거짓 불일치가 뜬다.
   */
  gov24ServiceId: string | null;
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
  // savings_account: 청약저축 등 — 대출도 보증료 지원도 아니지만 "현금 지원금"이
  // 아니라는 점(계산 안 함)은 같아서 이 타입을 그대로 쓴다.
  productType: "loan_interest_subsidy" | "guarantee_fee_subsidy" | "savings_account";
  summary: string;
  sourceUrl: string;
  applyUrl: string;
  verifiedAt: string | null;
  effectiveYear: number;
  notes: string;
}

/**
 * 저가 주택 실물 공급형 정책 — 매입임대주택·기숙사 등, 이미 고정된 싼 임대료로
 * 특정 주택 자체를 배정받는 정책이다. "지원금을 준다"가 아니므로 policies.json
 * 의 benefitType(월 상한·정액·일시금, 전부 "지급액 계산" 모델)에 안 맞고,
 * LoanProductMeta(대출·보증료·저축 상품)에도 안 맞는다 — 이 정책에 당첨되면
 * 그 배정된 주택이 곧 사용자의 계약 조건이 되므로, "실제 계약 조건에 지원금을
 * 더한다"는 이 앱의 계산 모델 자체가 애초에 적용되지 않는다.
 *
 * loan-products.json 과 같은 이유로 계산하지 않고 1층·2층 판정 파이프라인도
 * 타지 않는다 — /result 에 안내 전용으로만 노출한다.
 */
export interface HousingSupplyMeta {
  id: string;
  name: string;
  agency: string;
  regionScope: string;
  /** 공급 위치(주소). 특정 건물 하나인 경우가 많다. */
  location: string;
  /** 월 임대료(원). 방수 등에 따라 범위가 있으면 min~max, 단일 금액이면 둘이 같다. */
  monthlyRentMin: number;
  monthlyRentMax: number;
  deposit: number;
  /** 모집호수·정원 등 원문 표현을 그대로 적는다(단위가 "호"·"명"으로 갈려 숫자 하나로 통일하지 않는다). */
  capacityLabel: string;
  /** 한 회차의 신청기간. 여러 회차가 반복되는 모집이면 null 로 두고 applicationPeriodNote 를 쓴다. */
  applicationStart: string | null;
  applicationEnd: string | null;
  /** 반복 모집 주기 등, 단일 기간(YYYY-MM-DD ~ YYYY-MM-DD)으로 표현할 수 없는 경우의 설명. */
  applicationPeriodNote: string | null;
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

/**
 * 현재 주거 형태.
 *
 * 월세만 다루던 때는 물어볼 필요가 없었다. 전세 상품(보증료 지원)이 들어오면서
 * 갈라야 한다 — 전세 사는 사람에게 월세 지원금을 '가능성 있음'으로 보여주면
 * 신청했다가 반려된다.
 *
 * **연세를 월세와 따로 둔다.** 대학가에서 실제로 쓰이는 계약 형태이고 다른 앱이
 * 다루지 않는 것이라, 이 앱은 2층에서 연세 선납액을 월 환산해 지원금을 계산한다
 * (PRD F1-1·F1-5, lib/rent.ts). 그래서 월세 지원 사업의 housingTypes 에는
 * 월세와 연세가 함께 들어간다 — 연세를 빼면 1층이 '대상 아님'이라고 말한 사람을
 * 2층이 계산해 주는 모순이 된다.
 *
 * '그 외'는 공공임대·기숙사·가족과 거주를 합친 값이다. 넷으로 나눠 두었더니
 * 판정 결과가 모두 같았다(주거 형태를 따지지 않는 정책만 남는다). 결과를 바꾸지
 * 않는 구분은 고를 것만 늘린다. 사글세·전대차처럼 이름만 다른 월세는 '월세'다.
 *
 * '모름'을 두지 않는다. 사용자가 확인할 수 있는 사실이므로 하나를 골라야 다음으로 간다.
 */
export type HousingType = "월세" | "연세" | "전세" | "그 외";

/** 1층 질문 5개에 대한 답. null은 아직 답하지 않았거나 옛 저장값을 다시 물어봐야 한다는 뜻이다. */
export interface DiscoveryAnswers {
  housingType: HousingType | null;
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

/**
 * 1층 카드에 붙는 상태. 태그(DiscoveryTag)와 접수 기간을 합친 값이다.
 *
 * 태그만으로는 사용자가 다음에 뭘 해야 하는지 알 수 없다 — '가능성 있음' 은
 * 지금 신청하라는 뜻일 수도, 다음 회차를 기다리라는 뜻일 수도 있었다.
 * 판정 규칙은 그대로 두고 표현만 행동 단위로 바꾼 값이다 (discovery.cardStatus).
 */
export type DiscoveryCardStatus =
  | "신청 가능"
  | "확인 필요"
  | "신청 예정"
  | "접수 마감"
  | "대상 아님";

export interface TagResult {
  tag: DiscoveryTag;
  failReasons: string[]; // '해당 없음'일 때 모든 탈락 이유
  unknownFields: string[]; // '확인 필요'일 때 모름으로 남은 항목 이름
}

export interface IncomeBracket {
  bracket: number;
  label: string;
}
