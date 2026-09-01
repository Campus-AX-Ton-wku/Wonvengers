import { describe, expect, it } from "vitest";
import { AGE_MIN, POLICY_AGE_MAX, resolveAnswers } from "@/lib/age";
import type { DiscoveryAnswers } from "@/lib/types";

describe("resolveAnswers", () => {
  const 답변: DiscoveryAnswers = {
    birthDate: "1998-03-14",
    region: "전북특별자치도 익산시",
    status: "재직",
    incomeBracket: 2,
    housingType: null,
  };

  it("생년월일을 기준일 시점의 만 나이로 바꾼다", () => {
    expect(resolveAnswers(답변, "2026-08-30").age).toBe(28);
  });

  it("생일이 아직 안 지났으면 한 살 적다", () => {
    expect(resolveAnswers({ ...답변, birthDate: "1998-12-01" }, "2026-08-30").age).toBe(27);
  });

  it("생일 당일에 한 살 올라간다", () => {
    expect(resolveAnswers({ ...답변, birthDate: "1998-08-30" }, "2026-08-30").age).toBe(28);
  });

  it("생년월일을 아직 안 골랐으면 나이는 모름이다", () => {
    expect(resolveAnswers({ ...답변, birthDate: null }, "2026-08-30").age).toBeNull();
  });

  /*
   * 정적 export 라 기준일은 브라우저에서만 들어온다 (find/page.tsx 의 asOf —
   * 빌드 시점 날짜가 HTML 에 박히면 안 된다). 서버 렌더링 때는 오늘이 며칠인지
   * 모르므로 나이도 모름이어야 한다. 1970년 기준으로 음수 나이를 내면 안 된다.
   */
  it("기준일을 아직 모르면 나이도 모름이다", () => {
    expect(resolveAnswers(답변, null).age).toBeNull();
  });

  // 저장된 값이 깨져 있어도 숫자를 지어내면 안 된다. 판정이 '확인 필요'로 가야
  // 하는데 NaN 을 흘려보내면 비교가 전부 false 라 '가능성 있음'이 되어 버린다.
  it("생년월일이 깨져 있으면 나이는 모름이다", () => {
    expect(resolveAnswers({ ...답변, birthDate: "이상한값" }, "2026-08-30").age).toBeNull();
  });

  it("나이 말고 다른 답변은 그대로 넘긴다", () => {
    const 결과 = resolveAnswers(답변, "2026-08-30");

    expect(결과.region).toBe("전북특별자치도 익산시");
    expect(결과.status).toBe("재직");
    expect(결과.incomeBracket).toBe(2);
  });

  it("생년월일 자체는 판정 쪽으로 넘기지 않는다", () => {
    expect(resolveAnswers(답변, "2026-08-30")).not.toHaveProperty("birthDate");
  });
});
