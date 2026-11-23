import { resolveAnswers } from "./age";
import { isWithinWindow } from "./date";
import { tagPolicy } from "./filter";
import { policiesForRegion } from "./region";
import type { DiscoveryAnswers, ListingInput, PolicyMeta } from "./types";

/**
 * 2층(판정 질문 · 계산)이 다루는 정책 (11/23 ggue — '1차 질문으로 줄인 정책에 맞춰서만 추가로 묻는다').
 *
 * 예전에는 계약 지역의 정책 **전부**에서 질문을 모았다. 그래서 첫 질문에서 이미 '해당 없음'인 정책과
 * 접수가 끝난 정책(국토부 청년월세 — 2026년 5/29 마감)의 질문까지 물었다 — '원가구 소득도 함께 심사받나요?'처럼
 * 답해도 결과가 하나도 바뀌지 않는 질문이었다.
 *
 * - calculationScope: 계산(판정)에 넣는 정책 = 계약 지역 정책 − 첫 질문에서 '해당 없음'.
 *   접수 기간이 지난 정책은 남긴다 — 질문 없이도 '신청 불가'로 판정되고, 전부 마감이면 결과가 '기간 지남' 화면이 된다.
 * - questionScope: 판정 질문을 묻는 정책 = calculationScope 중 지금 접수 중인 것.
 * 결과 · 홈 · 달력 · 배지 · 정책 상세는 calculationScope, 판정 질문 화면 · 계산 진행률은 questionScope 를 쓴다 —
 * 둘이 어긋나면 묻지 않은 질문이 '모름'으로 남아 그 정책이 '조건 충족 시 가능'으로 잘못 뜬다.
 *
 * 첫 질문의 지역 · 주거 형태 대신 계약 조건의 지역 · 계약 형태를 쓴다 — 계산하는 것은 그 매물이다
 * (예: 기숙사에 살며 '그 외'로 답한 사람이 월세 방을 계산해 볼 때 월세 지원이 빠지면 안 된다).
 * 첫 질문을 건너뛴 사람(답 없음)은 '해당 없음'이 나오지 않아 지역 정책이 그대로 남는다.
 */
export function calculationScope(
  policies: PolicyMeta[],
  listing: Pick<ListingInput, "region" | "contractType">,
  answers: DiscoveryAnswers,
  asOfISO: string
): PolicyMeta[] {
  const resolved = { ...resolveAnswers(answers, asOfISO), region: listing.region, housingType: listing.contractType };
  return policiesForRegion(policies, listing.region).filter((policy) => tagPolicy(policy, resolved).tag !== "해당 없음");
}

export function questionScope(
  policies: PolicyMeta[],
  listing: Pick<ListingInput, "region" | "contractType">,
  answers: DiscoveryAnswers,
  asOfISO: string
): PolicyMeta[] {
  return calculationScope(policies, listing, answers, asOfISO).filter(
    (policy) => isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd) === "within"
  );
}
