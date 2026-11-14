import type { ConsultCenterMeta, LoanProductMeta, PolicyMeta } from "./types";

/** 정책 데이터와 화면이 함께 쓰는 시·군·구 한 항목. */
export interface RegionOption {
  /** `시도 시군구` 정식명. 정책의 regionScope와 같은 어휘를 쓴다. */
  value: string;
  /** 다른 화면의 select에서도 뜻이 분명하도록 정식명을 표시한다. */
  label: string;
  /** 답변 요약에 쓰는 짧은 이름. */
  chipLabel: string;
}

/** Find에서 먼저 고르는 시·도와, 그 다음에 보여줄 시·군·구 목록. */
export interface RegionProvince {
  name: string;
  chipLabel: string;
  districts: readonly RegionOption[];
}

function districts(province: string, names: readonly string[]): RegionOption[] {
  return names.map((name) => ({
    value: `${province} ${name}`,
    label: `${province} ${name}`,
    chipLabel: name,
  }));
}

/**
 * 거주 지역 선택지. 2026-11-15 에 목표 지역을 전북특별자치도 익산시 하나로 정했다(노찬영 결정).
 *
 * 시·도 → 시·군·구 두 단계 화면 구조는 그대로 두고 선택지만 줄였다. 다른 지역을 다시 열 때는
 * 여기에 시·도와 시·군·구를 더하면 된다 — 정책 데이터의 regionScope 와 같은 어휘를 쓴다.
 * (17개 시·도 전체 목록은 git 기록 2026-09-03 판에 있다)
 */
export const REGION_HIERARCHY: readonly RegionProvince[] = [
  {
    name: "전북특별자치도",
    chipLabel: "전북",
    districts: districts("전북특별자치도", ["익산시"]),
  },
] as const;

/** 판정·요약·계약 입력 화면이 소비하는 평탄화 목록. */
export const REGION_OPTIONS: readonly RegionOption[] = REGION_HIERARCHY.flatMap(
  (province) => province.districts
);

export type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

export function isRegionValue(value: string): value is RegionValue {
  return REGION_OPTIONS.some((option) => option.value === value);
}

/** 저장된 시군구 값이 어느 시도에 속하는지 찾는다. */
export function provinceForRegion(value: string | null): RegionProvince | null {
  if (!value) return null;
  return REGION_HIERARCHY.find((province) =>
    province.districts.some((district) => district.value === value)
  ) ?? null;
}

const strip = (s: string) => s.replace(/\s/g, "");

/** 정책의 regionScope가 사용자의 시군구에 적용되는가. */
export function policyAppliesToRegion(regionScope: string, region: string): boolean {
  if (regionScope === "전국") return true;
  if (!region) return false;
  // 시군구 사용자는 소속 시도 정책도 받는다.
  return strip(region).startsWith(strip(regionScope));
}

/** 사용자 지역에 해당하는 정책만 남긴다. 여기서 빠진 정책의 질문은 아예 묻지 않는다. */
export function policiesForRegion(policies: PolicyMeta[], region: string): PolicyMeta[] {
  return policies.filter((policy) => policyAppliesToRegion(policy.regionScope, region));
}

/** 사용자 지역에 해당하는 대출·보증 상품만 남긴다. */
export function loanProductsForRegion(products: LoanProductMeta[], region: string): LoanProductMeta[] {
  return products.filter((product) => policyAppliesToRegion(product.regionScope, region));
}

/**
 * 지역 상담 창구. 가까운 곳이 먼저 오게 regionScope 가 긴 순서로 — 익산시 창구가
 * 전국 콜센터보다 위에 있어야 한다.
 */
export function consultCentersForRegion(centers: ConsultCenterMeta[], region: string): ConsultCenterMeta[] {
  const scopeRank = (c: ConsultCenterMeta) => (c.regionScope === "전국" ? 0 : strip(c.regionScope).length);
  return centers
    .filter((c) => policyAppliesToRegion(c.regionScope, region))
    .sort((a, b) => scopeRank(b) - scopeRank(a));
}

/**
 * 여러 시·도에 같은 이름이 있는 시·군·구 (중구·동구·서구·남구·북구·강서구·고성군).
 * 손으로 적지 않고 REGION_HIERARCHY 에서 센다 — 시군구가 늘면 같이 늘어난다.
 */
export const DUPLICATE_DISTRICT_NAMES: ReadonlySet<string> = (() => {
  const counts = new Map<string, number>();
  for (const province of REGION_HIERARCHY) {
    for (const district of province.districts) {
      counts.set(district.chipLabel, (counts.get(district.chipLabel) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name));
})();

/**
 * 답 요약에 쓰는 짧은 지역 이름. "익산시" 처럼 시·군·구 이름만 쓰되, 여러 시·도에 겹치는
 * 이름이면 "부산 중구" 처럼 시·도 약칭(REGION_HIERARCHY 의 chipLabel)을 붙인다. 모르는 값은
 * 그대로 돌려준다.
 */
export function regionDisplayName(region: string): string {
  const province = provinceForRegion(region);
  const district = province?.districts.find((d) => d.value === region);
  if (!province || !district) return region;
  return DUPLICATE_DISTRICT_NAMES.has(district.chipLabel)
    ? `${province.chipLabel} ${district.chipLabel}`
    : district.chipLabel;
}
