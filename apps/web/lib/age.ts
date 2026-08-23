/**
 * 1층 나이 질문의 입력 규칙.
 *
 * 나이는 목록에서 골라 넣는다. 한 살씩 −/+ 로 누르면 25살까지 일곱 번을 눌러야 한다.
 *
 * 하한을 20 으로 올리지 않는 이유: 전북청년 지역정착과 익산 이사비가 만 18세부터
 * 대상이라, 18·19세를 뺀 목록을 주면 그 사람들이 자기 대상 정책을 아예 못 본다.
 */

/** 정책 데이터의 가장 낮은 ageMin */
export const AGE_MIN = 18;
/** 정책 데이터의 가장 높은 ageMax. 이 나이를 넘으면 대상 정책이 없다. */
export const POLICY_AGE_MAX = 39;
/**
 * 선택 목록의 상한. 정책 상한(39)보다 넉넉하게 둔다 — 40대 초반 사용자도 나이를
 * 답할 수 있어야 "왜 해당되는 게 없는지"를 화면에서 알 수 있다.
 */
export const AGE_MAX = 45;

/** 선택 목록에 넣을 나이들 (18~45). */
export const AGE_OPTIONS: number[] = Array.from(
  { length: AGE_MAX - AGE_MIN + 1 },
  (_, i) => AGE_MIN + i
);

/** 이 나이를 대상으로 하는 정책이 아예 없는지. 화면에서 안내 문구를 띄우는 데 쓴다. */
export function isAgeOutOfRange(age: number | null): boolean {
  if (age === null) return false;
  return age < AGE_MIN || age > POLICY_AGE_MAX;
}
