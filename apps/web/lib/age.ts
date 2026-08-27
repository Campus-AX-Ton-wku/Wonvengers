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

/**
 * 선택 목록을 '해당되는 지원금 있음 / 없음' 두 묶음으로 나눈다 (<optgroup>).
 *
 * 40~45세를 목록에 남기는 이유는 위 AGE_MAX 주석에 있다 — 그 사람들도 나이를
 * 답해서 "왜 해당되는 게 없는지"를 알아야 한다. 그런데 그 안내는 **고른 뒤에**
 * 뜨므로, 고르기 전에는 그 옵션이 무용하다는 걸 알 수 없었다.
 *
 * 그래서 지우는 대신 묶어서 표시한다. 지우면 41세에게 남는 길은 셋뿐이고 전부
 * 나쁘다 — 39세를 고르거나(거짓. 받을 수 없는 금액을 받을 수 있다고 믿는다),
 * 모름으로 두거나(대상이 아닌 걸 끝까지 모른다), 앱이 고장났다고 판단한다.
 *
 * 경계는 isAgeOutOfRange 하나에서 나온다. 정책 데이터의 ageMax 가 바뀌어
 * POLICY_AGE_MAX 를 올리면 그룹도 따라 움직인다.
 */
export function ageOptionGroups(): { label: string; ages: number[] }[] {
  return [
    {
      label: `해당되는 지원금 있음 (만 ${AGE_MIN}~${POLICY_AGE_MAX}세)`,
      ages: AGE_OPTIONS.filter((age) => !isAgeOutOfRange(age)),
    },
    {
      label: `해당되는 지원금 없음 (만 ${POLICY_AGE_MAX + 1}세 이상)`,
      ages: AGE_OPTIONS.filter((age) => isAgeOutOfRange(age)),
    },
    // 정책 상한이 목록 상한까지 올라가면 '없음' 묶음이 빈다. 빈 그룹은 내보내지 않는다.
  ].filter((group) => group.ages.length > 0);
}
