import type { PolicyMeta } from "./types";

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
