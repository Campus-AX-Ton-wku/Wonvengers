import { describe, expect, it } from "vitest";
import { INPUT_AGE_MAX, birthYearOptions } from "@/lib/birth";
import { AGE_MIN, POLICY_AGE_MAX } from "@/lib/age";

/**
 * 생년 목록의 범위.
 *
 * 이 목록은 '누가 지원 대상인가'가 아니라 '누가 답할 수 있는가'를 정한다. 둘을
 * 같은 상수로 묶으면 대상이 아닌 사람이 나이를 답할 방법 자체가 없어진다 —
 * 그러면 왜 해당되는 게 없는지 화면에서 알 수가 없다.
 */
describe("birthYearOptions", () => {
  it("맨 위가 만 18세 생년이다 — 전북 정착·익산 이사비가 18세부터 대상이다", () => {
    expect(birthYearOptions(2026)[0]).toBe(2026 - AGE_MIN);
  });

  it("만 64세 생년까지 내려간다 — 46세 이상도 자기 나이를 답할 수 있어야 한다", () => {
    expect(INPUT_AGE_MAX).toBe(64);
    expect(birthYearOptions(2026).at(-1)).toBe(2026 - 64);
  });

  it("입력 범위는 정책 상한보다 넓다 — 대상이 아닌 사람도 답할 수 있어야 한다", () => {
    expect(INPUT_AGE_MAX).toBeGreaterThan(POLICY_AGE_MAX);
  });

  // 이게 원래 불편했던 지점이다 — <input type="date"> 는 올해(2026)에서 시작한다.
  it("올해가 목록에 없다 — 첫 줄이 이미 청년 생년대다", () => {
    expect(birthYearOptions(2026)).not.toContain(2026);
    expect(birthYearOptions(2026)).toContain(2007); // '올해 성인' 생년
  });

  it("해가 바뀌면 목록도 한 칸 따라 내려간다", () => {
    expect(birthYearOptions(2027)[0]).toBe(2027 - AGE_MIN);
  });

  it("최신 생년부터 내림차순으로 한 해도 빠지지 않는다", () => {
    const 목록 = birthYearOptions(2026);

    expect(목록).toHaveLength(INPUT_AGE_MAX - AGE_MIN + 1);
    for (let i = 1; i < 목록.length; i++) {
      expect(목록[i - 1] - 목록[i]).toBe(1);
    }
  });
});
