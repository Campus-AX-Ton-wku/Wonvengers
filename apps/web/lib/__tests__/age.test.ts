import { describe, expect, it } from "vitest";
import { AGE_MIN, POLICY_AGE_MAX, isAgeOutOfRange, resolveAnswers } from "@/lib/age";
import type { DiscoveryAnswers } from "@/lib/types";

describe("isAgeOutOfRange", () => {
  it("대상 정책이 없는 나이를 알려준다", () => {
    expect(isAgeOutOfRange(17)).toBe(true);
    expect(isAgeOutOfRange(40)).toBe(true);
  });

  // 입력 범위(만 18~64세)를 정책 범위보다 넓게 열어 둔 이유가 이 안내다.
  // 답할 수는 있지만 대상이 아닌 사람에게 왜 해당되지 않는지 말해줘야 한다.
  it("답할 수 있지만 대상 정책이 없는 나이도 범위 밖으로 본다", () => {
    expect(isAgeOutOfRange(45)).toBe(true);
    expect(isAgeOutOfRange(64)).toBe(true);
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
 * 1층은 나이 대신 생년월일을 받는다. 판정 코드(filter·discovery)는 여전히 나이만
 * 보므로, 화면 경계에서 한 번 나이로 바꿔 넘긴다.
 *
 * 저장하는 값이 생년월일이어야 하는 이유: 나이를 저장하면 시간이 지나면서 조용히
 * 거짓이 된다. 만 39세로 저장된 사람은 반년 뒤에도 39세로 판정된다.
 */
describe("resolveAnswers", () => {
  const 답변: DiscoveryAnswers = {
    birthDate: "1998-03-14",
    region: "전북특별자치도 익산시",
    status: "재직",
    incomeBracket: 2,
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
