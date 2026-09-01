/** 오늘 날짜(YYYY-MM-DD). 판정 기준일이므로 화면마다 따로 만들지 않는다. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calcAge(birthDateISO: string, asOfISO: string): number {
  const birth = new Date(birthDateISO);
  const asOf = new Date(asOfISO);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * 화면에 찍는 날짜. 저장·판정은 계속 ISO(2026-05-29)를 쓰고, 사람에게 보이는
 * 자리에서만 2026.05.29 로 바꾼다. 카드와 상세 화면이 갈라지지 않게 한 곳에 둔다.
 */
export function formatDotDate(iso: string): string {
  return iso.replace(/-/g, ".");
}

export function isWithinWindow(
  asOfISO: string,
  startISO: string,
  endISO: string | null
): "before" | "within" | "after" {
  const asOf = new Date(asOfISO).getTime();
  const start = new Date(startISO).getTime();
  if (asOf < start) return "before";
  if (endISO === null) return "within";
  const end = new Date(endISO).getTime();
  return asOf > end ? "after" : "within";
}

/* ── 날짜를 년/월/일 목록으로 고르기 ──────────────────────────────────
 *
 * <input type="date"> 는 기기마다 생김새가 다르고, 모바일에서 오늘 날짜부터
 * 시작해 원하는 해까지 굴려야 한다. 네이티브 <select> 세 개로 나누면 모바일에서
 * 휠 피커로 뜨고 키보드·스크린리더가 그냥 동작한다 (lib/age.ts 의 나이 목록과 같은 판단).
 */

export const MONTH_OPTIONS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/** month 는 1~12. 윤년 2월은 29일이 된다. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 년·월을 아직 고르지 않았으면 31일까지 보여준다. */
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

/**
 * 계약 시작 예정일의 연도 목록. 오름차순으로 작년 ~ 내후년.
 *
 * '예정일'이라 대부분 올해나 내년이지만, 작년을 함께 넣는다 — 상시 접수 정책
 * (이사비·주거급여 분리지급)은 이미 계약한 사람이 뒤늦게 신청하는 경우가 있어서,
 * 작년을 빼면 그 사람이 실제 계약일을 넣을 수 없다.
 */
export function contractYearOptions(currentYear: number): number[] {
  return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
}
