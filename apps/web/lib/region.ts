import type { PolicyMeta } from "./types";

/**
 * 지역 선택지. data/policies.json 의 regionScope 값에서 유도한다.
 * 자유 입력을 쓰면 "익산" / "전북 익산시" / "익산시" 를 전부 매칭해야 해서
 * 정책 필터가 조용히 틀리기 쉽다. 선택지로 고정해 그 문제를 없앤다.
 */
export const REGION_OPTIONS = [
  // chipLabel 은 목록 화면의 답변 요약 칩에 쓰는 짧은 이름이다. 지역 어휘가
  // 갈라지지 않도록 선택지와 같은 곳에 둔다.
  { value: "전북특별자치도 익산시", label: "전북특별자치도 익산시", chipLabel: "익산시" },
  { value: "전북특별자치도", label: "전북특별자치도 (익산시 외)", chipLabel: "전북 (익산시 외)" },
  { value: "그 외 지역", label: "그 외 지역 (전국 정책만 해당)", chipLabel: "그 외 지역" },
] as const;

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
