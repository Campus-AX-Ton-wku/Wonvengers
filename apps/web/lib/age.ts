/**
 * 1층 나이 조건과, 저장된 생년월일을 판정용 나이로 바꾸는 경계.
 *
 * 1층은 나이가 아니라 생년월일을 받는다 (find/page.tsx 의 BirthDatePicker 주석).
 * 여기 있는 상수는 '누가 대상인가'만 말하고, '무엇을 고를 수 있는가'는 말하지
 * 않는다 — 그 둘을 한 값으로 묶으면 대상이 아닌 사람이 자기 나이를 답할 방법이
 * 없어진다. 입력 범위는 lib/birth.ts 의 INPUT_AGE_MAX 가 따로 정한다.
 */

import { calcAge } from "./date";
import type { DiscoveryAnswers, ResolvedAnswers } from "./types";

/**
 * 정책 데이터의 가장 낮은 ageMin.
 *
 * 18 인 이유: 전북청년 지역정착과 익산 이사비가 만 18세부터 대상이다. 20 으로
 * 올리면 18·19세가 자기 대상 정책을 아예 못 본다.
 */
export const AGE_MIN = 18;

/** 정책 데이터의 가장 높은 ageMax. 이 나이를 넘으면 대상 정책이 없다. */
export const POLICY_AGE_MAX = 39;

/**
 * 저장된 생년월일을 기준일 시점의 만 나이로 바꾼다.
 *
 * 판정 코드는 나이만 본다. 생년월일을 그쪽으로 흘려보내면 기준일 인자가 판정
 * 함수 전체로 번지므로, 화면 경계에서 여기 한 번만 바꾼다. (types.ts 의
 * ResolvedAnswers 주석 참고)
 */
export function resolveAnswers(
  answers: DiscoveryAnswers,
  /** null 은 기준일을 아직 모른다는 뜻 — 정적 export 라 브라우저에서만 들어온다. */
  asOfISO: string | null
): ResolvedAnswers {
  const { birthDate, ...rest } = answers;
  return { ...rest, age: ageOn(birthDate, asOfISO) };
}

/**
 * 생년월일이나 기준일 중 하나라도 없거나 깨졌으면 '모름'(null)이다.
 *
 * 숫자를 지어내면 안 된다 — filter 의 나이 비교는 NaN 이면 전부 false 라서 자격이
 * 없는 사람도 '가능성 있음'이 되고, 기준일을 1970년으로 잡으면 만 -29세가 나온다.
 * 판단할 수 없을 땐 모름이 정직한 답이다.
 */
function ageOn(birthDate: string | null, asOfISO: string | null): number | null {
  if (birthDate === null || asOfISO === null) return null;
  const age = calcAge(birthDate, asOfISO);
  return Number.isFinite(age) ? age : null;
}
