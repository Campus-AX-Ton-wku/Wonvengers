import { describe, expect, it } from "vitest";
import { AGE_MAX, AGE_MIN, AGE_STEP_START, isAgeOutOfRange, parseAgeInput, stepAge } from "@/lib/age";

// 청년 정책인데 스테퍼가 0·1·2세부터 올라가는 게 이상하다는 지적에서 나온 규칙이다.
// 다만 하한을 20으로 막지는 않는다 — 전북청년 지역정착과 익산 이사비가 18세부터 대상이라,
// 20 미만을 못 넣게 하면 만 18·19세가 자기 대상 정책을 아예 못 본다.
describe("stepAge", () => {
  it("빈 값에서 올리면 20부터 시작한다", () => {
    expect(stepAge(null, 1)).toBe(20);
  });

  it("빈 값에서 내려도 20에서 시작한다", () => {
    expect(stepAge(null, -1)).toBe(20);
  });

  it("값이 있으면 1씩 움직인다", () => {
    expect(stepAge(22, 1)).toBe(23);
    expect(stepAge(22, -1)).toBe(21);
  });

  it("하한 18, 상한 45를 넘지 않는다", () => {
    expect(stepAge(AGE_MIN, -1)).toBe(AGE_MIN);
    expect(stepAge(AGE_MAX, 1)).toBe(AGE_MAX);
  });

  it("범위를 벗어난 값에서 움직이면 범위 안으로 들어온다", () => {
    expect(stepAge(17, 1)).toBe(AGE_MIN);
    expect(stepAge(60, -1)).toBe(AGE_MAX);
  });

  it("스테퍼 시작값은 하한보다 크다", () => {
    expect(AGE_STEP_START).toBeGreaterThan(AGE_MIN);
  });
});

describe("parseAgeInput", () => {
  it("빈 값은 '모름'(null)이다", () => {
    expect(parseAgeInput("")).toBeNull();
  });

  it("숫자를 그대로 읽는다", () => {
    expect(parseAgeInput("22")).toBe(22);
  });

  it("직접 타이핑한 18·19세는 살린다", () => {
    expect(parseAgeInput("18")).toBe(18);
    expect(parseAgeInput("19")).toBe(19);
  });

  // 타이핑 중간값을 지우거나 되돌리지 않는다. 범위 밖이라는 안내는 화면에서 따로 한다.
  it("범위를 벗어난 값도 지우지 않고 그대로 둔다", () => {
    expect(parseAgeInput("17")).toBe(17);
    expect(parseAgeInput("99")).toBe(99);
  });

  it("숫자가 아니면 '모름'이다", () => {
    expect(parseAgeInput("스물둘")).toBeNull();
    expect(parseAgeInput("-")).toBeNull();
  });
});

describe("isAgeOutOfRange", () => {
  it("대상 정책이 없는 나이를 알려준다", () => {
    expect(isAgeOutOfRange(17)).toBe(true);
    expect(isAgeOutOfRange(46)).toBe(true);
  });

  it("18~45세는 범위 안이다", () => {
    expect(isAgeOutOfRange(18)).toBe(false);
    expect(isAgeOutOfRange(23)).toBe(false);
    expect(isAgeOutOfRange(45)).toBe(false);
  });

  it("모름은 범위를 벗어난 것으로 보지 않는다", () => {
    expect(isAgeOutOfRange(null)).toBe(false);
  });
});
