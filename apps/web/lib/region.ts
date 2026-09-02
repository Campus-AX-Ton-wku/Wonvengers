import type { HousingSupplyMeta, LoanProductMeta, PolicyMeta } from "./types";

/**
 * 지역 선택지 하나. data/policies.json 의 regionScope 값과 같은 어휘를 쓴다.
 * 자유 입력을 쓰면 "익산" / "전북 익산시" / "익산시" 를 전부 매칭해야 해서
 * 정책 필터가 조용히 틀리기 쉽다. 선택지로 고정해 그 문제를 없앤다.
 */
export interface RegionOption {
  value: string;
  label: string;
  /** 목록 화면의 답변 요약 칩에 쓰는 짧은 이름. 지역 어휘가 갈라지지 않도록 선택지와 같은 곳에 둔다. */
  chipLabel: string;
}

/**
 * 시도 하나와, 그 안에서 고를 수 있는 시군구 선택지.
 *
 * 지금은 전북특별자치도 하나뿐이고 그 안에 익산시 하나뿐이지만, 전국으로
 * 넓힐 때 시도를 늘리는 게 아니라 이 배열에 항목을 추가하는 일이 되도록
 * 처음부터 시도 단위로 묶어 둔다.
 */
export interface RegionProvince {
  /** 시도 정식명. regionScope 매칭에 쓰는 값과 같다. */
  name: string;
  /** 이 시도에 속한 시군구 선택지. 시군구를 다 등록하기 전까지는 catchAll 이 나머지를 받는다. */
  districts: RegionOption[];
  /**
   * "이 시도 소속, 위 시군구 외" 선택지. 시도 단위 정책(regionScope 가 시도
   * 그 자체인 정책)을 매칭하려면 시군구를 하나도 등록하지 않은 사람도 골라야
   * 하므로 시도마다 반드시 둔다.
   */
  catchAll: RegionOption;
}

export const REGION_HIERARCHY: readonly RegionProvince[] = [
  {
    name: "전북특별자치도",
    districts: [{ value: "전북특별자치도 익산시", label: "전북특별자치도 익산시", chipLabel: "익산시" }],
    catchAll: { value: "전북특별자치도", label: "전북특별자치도 (익산시 외)", chipLabel: "전북 (익산시 외)" },
  },
  {
    // 서울 청년 부동산 중개보수 및 이사비 지원사업(전국화 Phase 2, 광역 발굴 1건째)을
    // 위해 추가했다. 구 단위 정책이 아직 없어 districts 는 비워 두고 catchAll 하나로
    // 시도 전체를 받는다 — 전북과 달리 시군구 선택지가 아직 필요 없다.
    name: "서울특별시",
    districts: [],
    catchAll: { value: "서울특별시", label: "서울특별시", chipLabel: "서울" },
  },
  {
    // 울산 청년가구 주거비 지원사업(전국화 Phase 2, 광역 2번째 시도)을 위해 추가했다.
    name: "울산광역시",
    districts: [],
    catchAll: { value: "울산광역시", label: "울산광역시", chipLabel: "울산" },
  },
  {
    // 인천형 청년월세 지원·천원 복비(전국화 Phase 2, 광역 3번째 시도)에 이어
    // 중구·동구 이사비 지원사업(시군구 확장 1·2라운드)을 위해 districts 를 채웠다.
    // 기존 시도 단위 정책(천원 복비 등)은 catchAll.value 를 그대로 유지해 안 깨진다.
    //
    // ⚠️ 2026-07-01 인천형 행정체제 개편으로 중구·동구가 폐지되고 제물포구·
    // 영종구로 재편됐다(서구도 서구·검단구로 분구) — 확인목록.md 14번 참고.
    // 중구·동구는 재편 이전에 등록된 정책의 지역값으로 그대로 남겨 뒀다 —
    // 인천청년포털 자체가 아직 두 지역명을 다 쓰고 있어(포털이 안 지웠거나
    // 경과조치일 수 있다) 임의로 지우지 않았다. 제물포구를 새로 추가한다.
    name: "인천광역시",
    districts: [
      { value: "인천광역시 중구", label: "인천광역시 중구", chipLabel: "인천 중구" },
      { value: "인천광역시 동구", label: "인천광역시 동구", chipLabel: "인천 동구" },
      { value: "인천광역시 영종구", label: "인천광역시 영종구", chipLabel: "인천 영종구" },
      { value: "인천광역시 제물포구", label: "인천광역시 제물포구", chipLabel: "인천 제물포구" },
    ],
    catchAll: {
      value: "인천광역시",
      label: "인천광역시 (중구·동구·영종구·제물포구 외)",
      chipLabel: "인천 (그 외)",
    },
  },
  {
    // 제주청년 희망충전 월세지원·중개수수료·이사비 지원(전국화 Phase 2, 광역
    // 5번째 시도)을 위해 추가했다.
    name: "제주특별자치도",
    districts: [],
    catchAll: { value: "제주특별자치도", label: "제주특별자치도", chipLabel: "제주" },
  },
  {
    // 부산청년 중개보수 및 이사비 지원(전국화 Phase 2, 광역 6번째 시도)을 위해
    // 추가했다.
    name: "부산광역시",
    districts: [],
    catchAll: { value: "부산광역시", label: "부산광역시", chipLabel: "부산" },
  },
  {
    // 세종 청년 주거임대료 지원사업(전국화 Phase 2, 광역 7번째 시도)을 위해
    // 추가했다.
    name: "세종특별자치시",
    districts: [],
    catchAll: { value: "세종특별자치시", label: "세종특별자치시", chipLabel: "세종" },
  },
  {
    // 광산청년온가(housing-supply.json, 전국화 Phase 2, 광역 8번째 시도)에 이어
    // 서구 천원 복비(시군구 확장 1라운드)를 위해 districts 를 채웠다.
    // '전남광주통합특별시' 표기 이슈는 region.ts notes·확인목록 참고 — '광주광역시'로 등록했다.
    name: "광주광역시",
    districts: [{ value: "광주광역시 서구", label: "광주광역시 서구", chipLabel: "광주 서구" }],
    catchAll: { value: "광주광역시", label: "광주광역시 (서구 외)", chipLabel: "광주 (서구 외)" },
  },
  {
    // 평택시 청년 월세 지원(시군구 확장 2라운드)을 위해 처음 추가했다. 경기도는
    // 도 단위 정책이 아직 없어 catchAll이 익산 패턴과 달리 '그 외 지역'과 겹치는
    // 셈이지만, 향후 경기도 자체 정책이 나오면 그대로 받을 자리로 남겨 둔다.
    name: "경기도",
    districts: [{ value: "경기도 평택시", label: "경기도 평택시", chipLabel: "평택시" }],
    catchAll: { value: "경기도", label: "경기도 (평택시 외)", chipLabel: "경기도 (평택시 외)" },
  },
  {
    // 음성군 청년월세 지원사업(시군구 확장 2라운드)에 이어 괴산군 청년취업자·
    // 청년농업인 주거비 지원(시군구 확장 4라운드)을 위해 districts 를 늘렸다.
    name: "충청북도",
    districts: [
      { value: "충청북도 음성군", label: "충청북도 음성군", chipLabel: "음성군" },
      { value: "충청북도 괴산군", label: "충청북도 괴산군", chipLabel: "괴산군" },
    ],
    catchAll: {
      value: "충청북도",
      label: "충청북도 (음성군·괴산군 외)",
      chipLabel: "충청북도 (그 외)",
    },
  },
  {
    // 고령군 청년 월세 주거비 지원사업(시군구 확장 2라운드)을 위해 처음 추가했다.
    name: "경상북도",
    districts: [{ value: "경상북도 고령군", label: "경상북도 고령군", chipLabel: "고령군" }],
    catchAll: { value: "경상북도", label: "경상북도 (고령군 외)", chipLabel: "경상북도 (고령군 외)" },
  },
  {
    // 하동형 청년 주거비 지원사업(시군구 확장 4라운드)을 위해 처음 추가했다.
    name: "경상남도",
    districts: [{ value: "경상남도 하동군", label: "경상남도 하동군", chipLabel: "하동군" }],
    catchAll: { value: "경상남도", label: "경상남도 (하동군 외)", chipLabel: "경상남도 (하동군 외)" },
  },
];

/** 등록된 시도 어디에도 속하지 않을 때 고르는 선택지. */
const OTHER_REGION: RegionOption = {
  value: "그 외 지역",
  label: "그 외 지역 (전국 정책만 해당)",
  chipLabel: "그 외 지역",
};

/**
 * 평탄화한 지역 선택지 목록 — 화면과 판정 코드가 실제로 소비하는 값이다.
 *
 * REGION_HIERARCHY 를 [시도1의 시군구들, 시도1의 catchAll, 시도2의 시군구들, ...]
 * 순서로 펼치고 맨 끝에 '그 외 지역'을 붙인다. 시도를 새로 추가해도 순서 규칙은
 * 그대로이므로 기존 선택지의 순서·값은 바뀌지 않는다 (익산시 → 전북(익산시 외)
 * → 그 외 지역, 지금과 동일).
 */
export const REGION_OPTIONS: readonly RegionOption[] = [
  ...REGION_HIERARCHY.flatMap((province) => [...province.districts, province.catchAll]),
  OTHER_REGION,
];

export type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

export function isRegionValue(value: string): value is RegionValue {
  return REGION_OPTIONS.some((o) => o.value === value);
}

const strip = (s: string) => s.replace(/\s/g, "");

/** 정책의 regionScope 가 사용자의 지역에 적용되는가. */
export function policyAppliesToRegion(regionScope: string, region: string): boolean {
  if (regionScope === "전국") return true;
  if (!region) return false;
  // "전북특별자치도 익산시" 사용자는 "전북특별자치도" 정책도 받는다 (상위 지자체).
  return strip(region).startsWith(strip(regionScope));
}

/** 사용자 지역에 해당하는 정책만 남긴다. 여기서 빠진 정책의 질문은 아예 묻지 않는다. */
export function policiesForRegion(policies: PolicyMeta[], region: string): PolicyMeta[] {
  return policies.filter((p) => policyAppliesToRegion(p.regionScope, region));
}

/**
 * 사용자 지역에 해당하는 대출·보증 상품만 남긴다. policiesForRegion 과 매칭 규칙
 * (policyAppliesToRegion)을 그대로 공유한다 — 결과 화면이 loan-products.json 을
 * 지역 구분 없이 통째로 보여주던 문제(익산·군산 전용 상품이 다른 지역 사용자에게도
 * 노출됨)를 policies.json 과 다른 방식으로 또 풀지 않기 위해서다.
 */
export function loanProductsForRegion(products: LoanProductMeta[], region: string): LoanProductMeta[] {
  return products.filter((p) => policyAppliesToRegion(p.regionScope, region));
}

/**
 * 사용자 지역에 해당하는 저가 주택 공급 정책만 남긴다. loanProductsForRegion 과
 * 똑같은 이유로 같은 매칭 규칙(policyAppliesToRegion)을 그대로 쓴다 — 지역
 * 필터가 필요한 안내 전용 목록이 늘 때마다 규칙을 새로 만들지 않는다.
 */
export function housingSupplyForRegion(items: HousingSupplyMeta[], region: string): HousingSupplyMeta[] {
  return items.filter((p) => policyAppliesToRegion(p.regionScope, region));
}
