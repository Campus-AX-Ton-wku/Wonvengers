/**
 * 원문 대조 + 담당 부서 전화 확인을 마친 시범 지역.
 *
 * 2026-10-23 멘토링: 정확히 파악하려면 범위를 좁혀라. 여기 있는 지역은
 * lib/__tests__/iksan-trust.test.ts 같은 불변식 테스트가 지킨다. 지역을 넓힐 때는
 * 그 테스트를 먼저 만들고 여기에 추가한다.
 */
export const TRUSTED_REGIONS: readonly string[] = ["전북특별자치도 익산시"];

export function isTrustedRegion(region: string | null): boolean {
  return region !== null && TRUSTED_REGIONS.includes(region);
}
