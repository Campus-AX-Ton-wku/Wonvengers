import { describe, expect, it } from "vitest";
import { AGE_MAX, AGE_MIN } from "@/lib/age";
import { birthYearOptions, dayOptions, daysInMonth, fromISODate, toISODate } from "@/lib/birth";

describe("생년 목록", () => {
  it("만 18세 생년이 맨 위, 만 45세 생년이 맨 아래다", () => {
    const years = birthYearOptions(2026);
    expect(years[0]).toBe(2026 - AGE_MIN); // 2008
    expect(years.at(-1)).toBe(2026 - AGE_MAX); // 1981
    expect(years).toHaveLength(AGE_MAX - AGE_MIN + 1);
  });

  // 이게 원래 불편했던 지점이다 — date 입력은 올해(2026)에서 시작한다.
  it("올해가 목록에 없다 — 첫 줄이 이미 청년 생년대다", () => {
    expect(birthYearOptions(2026)).not.toContain(2026);
    expect(birthYearOptions(2026)).toContain(2007); // '올해 성인' 생년
  });

  it("해가 바뀌면 목록도 한 칸 따라 내려간다", () => {
    expect(birthYearOptions(2027)[0]).toBe(2027 - AGE_MIN);
  });
});

describe("일 목록", () => {
  it("달마다 마지막 날이 다르다", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("윤년 2월은 29일까지다", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29); // 400의 배수는 윤년
    expect(daysInMonth(1900, 2)).toBe(28); // 100의 배수는 평년
  });

  it("년·월을 아직 안 골랐으면 31일까지 보여준다", () => {
    expect(dayOptions(null, null)).toHaveLength(31);
    expect(dayOptions(2024, 2)).toHaveLength(29);
  });
});

describe("ISO 변환", () => {
  it("한 자리 월·일에 0 을 채운다", () => {
    expect(toISODate(2007, 3, 5)).toBe("2007-03-05");
  });

  it("왕복해도 값이 유지된다", () => {
    expect(fromISODate(toISODate(2003, 8, 12))).toEqual({ year: 2003, month: 8, day: 12 });
  });

  it("빈 값·형식이 아닌 값은 null 이다 — 부분 선택 상태를 날짜로 오해하지 않는다", () => {
    expect(fromISODate("")).toBeNull();
    expect(fromISODate("2003-8-12")).toBeNull();
  });
});
