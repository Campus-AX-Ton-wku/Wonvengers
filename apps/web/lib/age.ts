/**
 * 1층 나이 질문의 입력 규칙.
 *
 * 스테퍼는 20부터 시작한다 — 청년 지원 정책인데 0·1·2세부터 올라가는 건 이상하다.
 * 다만 하한을 20으로 막지는 않는다: 전북청년 지역정착과 익산 이사비가 만 18세부터
 * 대상이라, 20 미만을 못 넣게 하면 18·19세가 자기 대상 정책을 아예 못 본다.
 */

/** 정책 데이터의 가장 낮은 ageMin */
export const AGE_MIN = 18;
/** 정책 데이터의 가장 높은 ageMax(39)보다 조금 넉넉하게 둔다 */
export const AGE_MAX = 45;
/** 빈 칸에서 스테퍼를 눌렀을 때 시작하는 나이 */
export const AGE_STEP_START = 20;

/** − / + 버튼용. 빈 값에서 누르면 20부터, 그다음부터는 1씩 움직이고 범위를 벗어나지 않는다. */
export function stepAge(current: number | null, direction: 1 | -1): number {
  if (current === null) return AGE_STEP_START;
  return Math.min(AGE_MAX, Math.max(AGE_MIN, current + direction));
}

/** 직접 타이핑한 값을 읽는다. 타이핑 중간값을 지우거나 되돌리지 않는다. */
export function parseAgeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** 이 나이를 대상으로 하는 정책이 아예 없는지. 화면에서 안내 문구를 띄우는 데 쓴다. */
export function isAgeOutOfRange(age: number | null): boolean {
  if (age === null) return false;
  return age < AGE_MIN || age > AGE_MAX;
}
