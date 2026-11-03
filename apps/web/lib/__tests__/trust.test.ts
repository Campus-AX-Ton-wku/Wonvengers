import { describe, expect, it } from "vitest";
import { isTrustedRegion } from "@/lib/trust";

describe("시범 지역", () => {
  it("익산은 원문·담당자 확인을 마친 지역이다", () => {
    expect(isTrustedRegion("전북특별자치도 익산시")).toBe(true);
  });
  it("같은 도의 다른 시는 아니다", () => {
    expect(isTrustedRegion("전북특별자치도 군산시")).toBe(false);
  });
  it("답하지 않았으면 아니다", () => {
    expect(isTrustedRegion(null)).toBe(false);
  });
});
