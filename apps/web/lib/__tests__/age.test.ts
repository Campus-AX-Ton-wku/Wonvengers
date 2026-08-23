import { describe, expect, it } from "vitest";
import { AGE_MAX, AGE_MIN, AGE_OPTIONS, POLICY_AGE_MAX, isAgeOutOfRange } from "@/lib/age";

/**
 * 나이는 목록에서 골라 넣는다 (네이티브 select — 모바일에서 휠 피커로 뜬다).
 * 한 살씩 −/+ 로 누르는 방식은 25살까지 일곱 번을 눌러야 해서 바꿨다.
 */
describe("AGE_OPTIONS", () => {
  it("만 18세부터 시작한다 — 전북 정착·익산 이사비가 18세부터 대상이다", () => {
    expect(AGE_OPTIONS[0]).toBe(18);
    expect(AGE_MIN).toBe(18);
  });

  it("정책 상한(39)보다 넉넉한 45세까지 고를 수 있다", () => {
    expect(AGE_OPTIONS.at(-1)).toBe(45);
    expect(AGE_MAX).toBeGreaterThan(POLICY_AGE_MAX);
  });

  it("빠짐없이 한 살씩 이어진다", () => {
    expect(AGE_OPTIONS).toHaveLength(AGE_MAX - AGE_MIN + 1);
    for (let i = 1; i < AGE_OPTIONS.length; i++) {
      expect(AGE_OPTIONS[i] - AGE_OPTIONS[i - 1]).toBe(1);
    }
  });
});

describe("isAgeOutOfRange", () => {
  it("대상 정책이 없는 나이를 알려준다", () => {
    expect(isAgeOutOfRange(17)).toBe(true);
    expect(isAgeOutOfRange(40)).toBe(true);
  });

  // 목록에서 40~45세를 고를 수 있게 열어 둔 이유가 이 안내다.
  it("고를 수 있지만 대상 정책이 없는 나이도 범위 밖으로 본다", () => {
    expect(isAgeOutOfRange(45)).toBe(true);
  });

  it("18~39세는 범위 안이다", () => {
    expect(isAgeOutOfRange(18)).toBe(false);
    expect(isAgeOutOfRange(23)).toBe(false);
    expect(isAgeOutOfRange(39)).toBe(false);
  });

  it("모름은 범위를 벗어난 것으로 보지 않는다", () => {
    expect(isAgeOutOfRange(null)).toBe(false);
  });
});
