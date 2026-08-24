import { describe, expect, it } from "vitest";
import { manwonToWon, wonToManwon } from "@/lib/money";

describe("만원 단위 입력", () => {
  it("3 을 넣으면 3만원이 된다", () => {
    expect(manwonToWon(3)).toBe(30_000);
    expect(manwonToWon(35)).toBe(350_000);
    expect(manwonToWon(300)).toBe(3_000_000);
  });

  it("소수도 받는다 — 관리비 5만 5천원 같은 금액", () => {
    expect(manwonToWon(5.5)).toBe(55_000);
  });

  it("음수·빈 값은 0 이다", () => {
    expect(manwonToWon(-5)).toBe(0);
    expect(manwonToWon(Number.NaN)).toBe(0);
  });

  it("저장된 원 금액을 만원으로 되돌려 보여준다", () => {
    expect(wonToManwon(350_000)).toBe(35);
    expect(wonToManwon(55_000)).toBe(5.5);
  });

  // 0 을 값으로 보여주면 지우고 입력해야 한다 — 빈 칸으로 둔다.
  it("0 이하는 빈 칸(null)이다", () => {
    expect(wonToManwon(0)).toBeNull();
    expect(wonToManwon(-1)).toBeNull();
  });

  it("왕복해도 금액이 어긋나지 않는다", () => {
    for (const won of [30_000, 55_000, 350_000, 3_000_000, 4_800_000]) {
      expect(manwonToWon(wonToManwon(won)!)).toBe(won);
    }
  });
});
