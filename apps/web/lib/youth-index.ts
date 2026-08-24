import indexJson from "@/data/youth-policy-index.json";
import type {
  PolicyMeta,
  YouthCorroboration,
  YouthPolicyIndex,
  YouthPolicyRecord,
} from "./types";

const index = indexJson as YouthPolicyIndex;

/** 색인을 만든 날. 화면에 "언제 대조한 정보인지" 표시하는 데 쓴다. */
export const YOUTH_INDEX_FETCHED_AT = index.fetchedAt;
export const YOUTH_INDEX_SOURCE = index.source;

/**
 * 정책 하나를 온통청년 등록 정보와 대조한 결과를 돌려준다.
 *
 * 세 가지 상태만 있다.
 *   일치   — 등록되어 있고 앱 데이터와 어긋나는 항목이 없다
 *   불일치 — 등록되어 있으나 신청기간·나이·정책명 중 하나 이상이 다르다
 *   미등록 — 온통청년에서 이 정책을 찾지 못했다 (youthPolicyNo 가 null)
 *
 * '불일치'를 숨기지 않는 것이 이 연동의 핵심이다. 정부 DB 와 다른데 조용히
 * 앱 값을 보여주면, 대조했다는 사실 자체가 사용자를 잘못 안심시킨다.
 */
export function corroborate(policy: PolicyMeta): YouthCorroboration {
  return corroborateWith(policy, index);
}

/** corroborate 의 순수 함수 버전. 색인을 주입받아 테스트할 수 있게 분리했다. */
export function corroborateWith(
  policy: PolicyMeta,
  src: YouthPolicyIndex
): YouthCorroboration {
  const fetchedAt = src.fetchedAt;

  if (!policy.youthPolicyNo) {
    return { state: "미등록", record: null, fetchedAt };
  }

  const record: YouthPolicyRecord | undefined = src.records[policy.youthPolicyNo];
  // youthPolicyNo 는 있는데 색인에 없다 = 아직 스크립트를 안 돌렸거나 조회에 실패했다.
  // 이때 '일치'라고 말하면 거짓이 된다. 미등록과 같이 취급한다.
  if (!record) {
    return { state: "미등록", record: null, fetchedAt };
  }

  return {
    state: record.mismatches.length > 0 ? "불일치" : "일치",
    record,
    fetchedAt,
  };
}

/** "20260415 ~ 20260930" → "2026-04-15 ~ 2026-09-30". 형식이 다르면 원문을 그대로 준다. */
export function formatApplyPeriod(raw: string | null): string | null {
  if (!raw) return null;
  const dates = raw.match(/\d{8}/g);
  if (!dates || dates.length === 0) return raw;
  const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return dates.length > 1 ? `${iso(dates[0])} ~ ${iso(dates[1])}` : `${iso(dates[0])} ~ 미기재`;
}

/**
 * 온통청년이 알려준 신청 링크 중 실제로 쓸 만한 것을 고른다.
 *
 * 앱 데이터의 applyUrl 이 기관 홈페이지 루트(예: https://www.iksan.go.kr)인 경우가
 * 있는데, 그건 F4-9 가 요구하는 "정책별 공식 신청 페이지"가 아니다. 온통청년이
 * 더 구체적인 주소를 가지고 있으면 그걸 함께 보여준다.
 */
export function betterApplyUrl(
  policy: PolicyMeta,
  record: YouthPolicyRecord | null
): string | null {
  const candidate = record?.applyUrl ?? record?.referenceUrl ?? null;
  if (!candidate) return null;
  if (candidate === policy.applyUrl) return null;

  // 경로가 없는 주소(도메인 루트)는 앱이 이미 가진 것보다 나을 게 없다.
  try {
    const path = new URL(candidate).pathname.replace(/\/+$/, "");
    if (path === "") return null;
  } catch {
    return null;
  }

  return candidate;
}
