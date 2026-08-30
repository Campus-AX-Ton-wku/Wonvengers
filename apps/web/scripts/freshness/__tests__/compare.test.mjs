import { describe, expect, it } from "vitest";
import { compareField, normalizeName } from "../compare.mjs";

/**
 * 3자 대조. 앱(policies.json) · 온통청년 · 보조금24 가 같은 값을 두고
 * 서로 다른 말을 할 때, **어느 쪽이 낡았는지** 판단할 근거를 만든다.
 *
 * 2자 대조로는 이걸 못 한다 — fetch-youth-policies.mjs 의 findMismatches 주석이
 * "어느 쪽이 맞는지는 이 스크립트가 알 수 없다"고 적어둔 그 한계다.
 */
describe("compareField", () => {
  it("세 소스가 같은 값을 말하면 검토할 게 없다", () => {
    const result = compareField({
      field: "신청종료일",
      app: "2026-05-29",
      youth: "2026-05-29",
      gov24: "2026-05-29",
    });

    expect(result.verdict).toBe("일치");
    expect(result.needsReview).toBe(false);
  });

  it("바깥 두 소스가 같고 앱만 다르면 앱을 먼저 의심한다", () => {
    const result = compareField({
      field: "신청종료일",
      app: "2026-05-29",
      youth: "2026-06-30",
      gov24: "2026-06-30",
    });

    expect(result.verdict).toBe("불일치");
    expect(result.priority).toBe("높음");
    expect(result.detail).toContain("앱");
  });

  it("앱이 한쪽과 같으면 우선순위를 낮춘다 — 바깥 한 곳이 낡은 흔한 경우다", () => {
    // 실제 사례: 보조금24 는 전국 청년월세를 "2026년 상반기"라 하고,
    // 앱과 공고 원문은 3/30~5/29 로 이미 끝났다고 한다. 앱이 맞다.
    const result = compareField({
      field: "신청종료일",
      app: "2026-05-29",
      youth: "2026-05-29",
      gov24: "2026-06-30",
    });

    expect(result.verdict).toBe("불일치");
    expect(result.priority).toBe("낮음");
    expect(result.detail).toContain("보조금24");
  });

  it("셋 다 다르면 바깥이 일치한다고 말하지 않는다", () => {
    const result = compareField({
      field: "신청종료일",
      app: "2026-05-29",
      youth: "2026-06-30",
      gov24: "2026-07-31",
    });

    expect(result.priority).toBe("높음");
    expect(result.detail).not.toContain("일치");
  });

  it("앱만 값을 말하면 대조할 수 없다고 밝힌다 — 일치로 세면 거짓 안심이다", () => {
    const result = compareField({
      field: "신청종료일",
      app: "2026-05-29",
      youth: null,
      gov24: null,
    });

    expect(result.verdict).toBe("대조불가");
    expect(result.needsReview).toBe(false);
  });

  it("normalize 를 주면 표기 차이는 넘기고 원문은 그대로 보고한다", () => {
    const result = compareField({
      field: "정책명",
      app: "청년월세 지원 (2026년 상시사업 전환)",
      youth: "청년월세 지원",
      gov24: "청년월세 지원",
      normalize: normalizeName,
    });

    expect(result.verdict).toBe("일치");
    expect(result.app).toBe("청년월세 지원 (2026년 상시사업 전환)"); // 원문 보존
  });
});

/**
 * 앱은 정책명에 팀이 붙인 주석을 달고 있다 — "(2026년 상시사업 전환)".
 * 이걸 그대로 대조하면 매주 같은 거짓 불일치가 뜨고, 진짜 신호가 묻힌다.
 */
describe("normalizeName", () => {
  it("괄호 주석과 공백을 무시한다", () => {
    expect(normalizeName("청년월세 지원 (2026년 상시사업 전환)")).toBe(normalizeName("청년월세 지원"));
  });

  it("다른 지자체 사업까지 같다고 하지는 않는다", () => {
    expect(normalizeName("파주시 청년월세 지원")).not.toBe(normalizeName("청년월세 지원"));
  });
});
