import { AGE_MAX, AGE_MIN } from "./age";

/**
 * 생년월일을 년/월/일 목록에서 고르기 위한 규칙.
 *
 * <input type="date"> 는 오늘(2026년)에서 시작한다 — 청년 사용자는 자기 생년까지
 * 19년을 거슬러 올라가야 한다. 목록 세 개로 나누면 맨 위가 바로 청년 생년대다.
 * 네이티브 <select> 를 쓰는 이유는 나이 목록과 같다 (lib/age.ts 주석 참고).
 */

/**
 * 목록 맨 위에 놓을 나이. AGE_MIN(18)을 쓰는 이유는 전북청년 지역정착·익산 이사비가
 * 만 18세부터 대상이기 때문이다 — 19세부터 시작하면 그 사람들이 생년을 못 고른다.
 * (만 19세 = '올해 성인'을 맨 위에 두고 싶으면 이 값만 19로 바꾸면 된다.)
 */
const YOUNGEST_AGE = AGE_MIN;

/** 최신 생년부터 내림차순. 2026년이면 2008 → 1981. */
export function birthYearOptions(currentYear: number): number[] {
  const newest = currentYear - YOUNGEST_AGE;
  const oldest = currentYear - AGE_MAX;
  return Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i);
}

export const MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/** month 는 1~12. 윤년 2월은 29일이 된다. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function dayOptions(year: number | null, month: number | null): number[] {
  const length = year !== null && month !== null ? daysInMonth(year, month) : 31;
  return Array.from({ length }, (_, i) => i + 1);
}

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromISODate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}
