import { describe, expect, it } from "vitest";
import {
  AGE_MAX,
  AGE_MIN,
  AGE_OPTIONS,
  POLICY_AGE_MAX,
  ageOptionGroups,
  isAgeOutOfRange,
} from "@/lib/age";

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

/**
 * 목록을 두 그룹으로 나눈다.
 *
 * 40~45세를 목록에 남기는 이유는 그 사람들도 나이를 답해서 "왜 해당되는 게
 * 없는지"를 알아야 하기 때문이다. 그런데 고르기 전에는 그 옵션이 무용하다는 걸
 * 알 수 없었다 — 41세를 고르고 나서야 안내가 뜬다.
 *
 * 그래서 지우는 대신 표시한다. 옵션을 빼면 41세는 39세를 고르거나(거짓 →
 * 받을 수 없는 금액을 보게 된다) 모름으로 두거나(끝까지 모른다) 셋 중 하나가 된다.
 */
describe("ageOptionGroups", () => {
  it("대상 정책이 있는 나이와 없는 나이를 나눈다", () => {
    const groups = ageOptionGroups();

    expect(groups).toHaveLength(2);
    expect(groups[0].ages).toContain(AGE_MIN);
    expect(groups[0].ages).toContain(POLICY_AGE_MAX);
    expect(groups[1].ages).toContain(POLICY_AGE_MAX + 1);
    expect(groups[1].ages).toContain(AGE_MAX);
  });

  it("경계가 isAgeOutOfRange 와 어긋나지 않는다", () => {
    const [있음, 없음] = ageOptionGroups();

    expect(있음.ages.every((a) => !isAgeOutOfRange(a))).toBe(true);
    expect(없음.ages.every((a) => isAgeOutOfRange(a))).toBe(true);
  });

  it("목록의 나이를 하나도 잃지 않는다", () => {
    const 합친것 = ageOptionGroups().flatMap((g) => g.ages);

    expect(합친것).toEqual(AGE_OPTIONS);
  });

  it("라벨이 어느 나이대인지 말해준다", () => {
    const [있음, 없음] = ageOptionGroups();

    expect(있음.label).toContain(String(AGE_MIN));
    expect(있음.label).toContain(String(POLICY_AGE_MAX));
    expect(없음.label).toContain(String(POLICY_AGE_MAX + 1));
  });
});
