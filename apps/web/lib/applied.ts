/**
 * 신청 완료 표시 (11/23 ggue) — '신청을 마쳤어요'로 표시한 지원금은 추천에서 그만 보인다.
 * 지원금 탭 · 1층 결과 · 홈(추천 · 관심 미리보기 · 오늘 할 일 · 일정) · 알림함 · 상단 종이 이 함수로 거른다.
 * 관심 탭은 '신청 완료' 보기에 따로 모으고, 결과 화면(계산)은 그대로 둔다 — 신청한 지원도 실제로 받을 돈이다.
 * 기록은 lib/storage.ts loadApplied (계정에 저장).
 */
export function notApplied<T extends { id: string }>(policies: readonly T[], applied: Readonly<Record<string, string>>): T[] {
  return policies.filter((p) => !(p.id in applied));
}

/** 관심 목록에서 신청 완료를 뺀다 — 관심 '전체' · '신청 준비 중' · 홈 · 알림함 */
export function notAppliedIds(ids: readonly string[], applied: Readonly<Record<string, string>>): string[] {
  return ids.filter((id) => !(id in applied));
}

/** 신청 완료 목록 — 최근에 표시한 것이 앞 (같은 날이면 그대로) */
export function appliedIds(applied: Readonly<Record<string, string>>): string[] {
  return Object.entries(applied)
    .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
    .map(([id]) => id);
}

/** '2026-11-23' → '11월 23일' */
export function appliedDayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${m}월 ${d}일`;
}
