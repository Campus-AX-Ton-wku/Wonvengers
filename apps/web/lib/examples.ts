import type { ExampleListing, ListingInput } from "./types";

/**
 * F1-11. 발표용 예시 매물을 입력값으로 옮긴다.
 *
 * 두 가지를 일부러 건드리지 않는다:
 *  - confirmedMatchesActualContract — 사용자 본인의 확인이다. 예시를 불러왔다고
 *    대신 켜주면 "내가 확인했다"는 진술을 앱이 위조하는 셈이 된다 (F1-10).
 *  - contractStartDate — 고정 날짜를 박아두면 시간이 지나 과거 날짜가 된다.
 */
export function exampleToListing(example: ExampleListing, current: ListingInput): ListingInput {
  return {
    ...current,
    ...example.listing,
    confirmedMatchesActualContract: false,
    exampleId: example.id,
  };
}

/** 팀이 실제로 확인한 매물인가. 확인 날짜가 없으면 출처 구분이 뭐라 적혀 있어도 미확인이다. */
export function isVerifiedExample(example: ExampleListing): boolean {
  return example.sourceKind !== "가상 예시" && example.verifiedAt !== null;
}

/** 화면에 그대로 붙이는 출처 배지 (F1-11). 확인 전 데이터가 실제 매물처럼 보이면 안 된다. */
export function exampleBadge(example: ExampleListing): string {
  if (example.sourceKind === "가상 예시") return "가상 예시 · 실제 매물이 아닙니다";
  if (example.verifiedAt === null) return `${example.sourceKind} · 확인 전 (미검증)`;
  return `${example.sourceKind} · ${example.verifiedAt} 확인`;
}
