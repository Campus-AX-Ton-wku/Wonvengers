import { describe, expect, it } from "vitest";
import { formatApproxMoney, formatKoreanMoney } from "@/lib/money";

// F1-8: 금액 단위 실수(0 하나 더/덜)는 입력하는 순간 보여야 잡을 수 있다.
// "400000" 옆에 "40만원"이 같이 뜨면 "4만원"을 넣으려던 사람이 바로 알아챈다.
describe("formatKoreanMoney", () => {
  it("만 단위로 끊어 읽어준다", () => {
    expect(formatKoreanMoney(400000)).toBe("40만원");
    expect(formatKoreanMoney(4500000)).toBe("450만원");
  });

  it("만 단위 아래가 남으면 함께 보여준다", () => {
    expect(formatKoreanMoney(123456)).toBe("12만 3,456원");
  });

  it("만원 미만은 그대로 보여준다", () => {
    expect(formatKoreanMoney(5000)).toBe("5,000원");
  });

  it("억 단위를 따로 끊는다 (보증금)", () => {
    expect(formatKoreanMoney(100000000)).toBe("1억원");
    expect(formatKoreanMoney(105000000)).toBe("1억 500만원");
    expect(formatKoreanMoney(107000000)).toBe("1억 700만원");
  });

  it("천 단위 구분 기호를 넣는다", () => {
    expect(formatKoreanMoney(45300000)).toBe("4,530만원");
  });

  it("0과 음수·비정상 값은 0원이다", () => {
    expect(formatKoreanMoney(0)).toBe("0원");
    expect(formatKoreanMoney(-1000)).toBe("0원");
    expect(formatKoreanMoney(Number.NaN)).toBe("0원");
  });
});

describe("formatApproxMoney — 홈 요약 상자용, 천 원 단위 (11/21)", () => {
  it("천 원 단위로 떨어지면 그대로 (약 없음)", () => {
    expect(formatApproxMoney(2_856_000)).toBe("285만 6,000원");
    expect(formatApproxMoney(5_400_000)).toBe("540만원");
  });
  it("원 단위가 남으면 천 원 단위로 반올림하고 '약'을 붙인다 — 정확한 값은 결과 화면에 있다", () => {
    expect(formatApproxMoney(1_599_996)).toBe("약 160만원");
    expect(formatApproxMoney(1_234_567)).toBe("약 123만 5,000원");
    expect(formatApproxMoney(1_234_400)).toBe("약 123만 4,000원");
  });
  it("0 이하는 0원", () => {
    expect(formatApproxMoney(0)).toBe("0원");
    expect(formatApproxMoney(-500)).toBe("0원");
  });
});
