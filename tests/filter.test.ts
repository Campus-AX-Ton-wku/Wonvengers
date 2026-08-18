import { describe, expect, it } from "vitest";
import { tagPolicy } from "@/lib/filter";
import type { Answers, Policy } from "@/lib/types";

// 익산시 전용, 만 19~39세, 대학생·재직만, 소득 3구간 이하
const 익산정책: Policy = {
  id: "test-iksan",
  tier: 1,
  name: "테스트 익산 월세지원",
  agency: "익산시",
  filter: {
    age_min: 19,
    age_max: 39,
    regions: ["익산시"],
    statuses: ["대학생", "재직"],
    income_bracket_max: 3,
  },
  extra_conditions: [],
  benefit_summary: "월 최대 20만원",
  benefit_type: "월세지원",
  application_start: "2026-03-01",
  application_end: "2026-11-30",
  source_url: "https://example.com",
  apply_url: "https://example.com",
  verified_at: "2026-08-13",
  verified_by: "테스트",
  effective_year: 2026,
};

// 전라북도 전체 대상
const 전북정책: Policy = {
  ...익산정책,
  id: "test-jeonbuk",
  name: "테스트 전북 주거지원",
  filter: { ...익산정책.filter, regions: ["전라북도"] },
};

const 기본답변: Answers = {
  age: 22,
  region: "익산시",
  status: "대학생",
  incomeBracket: 2,
};

describe("tagPolicy — 가능성 있음", () => {
  it("4개 조건을 모두 통과하면 가능성 있음", () => {
    const r = tagPolicy(익산정책, 기본답변);
    expect(r.tag).toBe("가능성 있음");
    expect(r.failReasons).toEqual([]);
    expect(r.unknownFields).toEqual([]);
  });

  it("익산시 거주자는 전라북도 정책의 대상이 된다", () => {
    const r = tagPolicy(전북정책, 기본답변);
    expect(r.tag).toBe("가능성 있음");
  });
});

describe("tagPolicy — 해당 없음", () => {
  it("나이가 상한을 넘으면 해당 없음", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: 45 });
    expect(r.tag).toBe("해당 없음");
    expect(r.failReasons).toHaveLength(1);
    expect(r.failReasons[0]).toContain("39");
  });

  it("나이가 하한보다 낮으면 해당 없음", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: 17 });
    expect(r.tag).toBe("해당 없음");
    expect(r.failReasons[0]).toContain("19");
  });

  it("전라북도(익산 외) 거주자는 익산시 전용 정책의 대상이 아니다", () => {
    const r = tagPolicy(익산정책, { ...기본답변, region: "전라북도 (익산 외)" });
    expect(r.tag).toBe("해당 없음");
  });

  it("그 외 지역 거주자는 전라북도 정책의 대상이 아니다", () => {
    const r = tagPolicy(전북정책, { ...기본답변, region: "그 외 지역" });
    expect(r.tag).toBe("해당 없음");
  });

  it("정책이 요구하지 않는 상태면 해당 없음", () => {
    const r = tagPolicy(익산정책, { ...기본답변, status: "구직" });
    expect(r.tag).toBe("해당 없음");
  });

  it("소득 구간이 상한을 넘으면 해당 없음", () => {
    const r = tagPolicy(익산정책, { ...기본답변, incomeBracket: 4 });
    expect(r.tag).toBe("해당 없음");
  });

  it("탈락 이유가 여러 개면 전부 반환한다", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: 45, incomeBracket: 5 });
    expect(r.tag).toBe("해당 없음");
    expect(r.failReasons).toHaveLength(2);
  });
});

describe("tagPolicy — 확인 필요", () => {
  it("나이를 모르면 확인 필요", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: null });
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["나이"]);
  });

  it("4개를 모두 모르면 확인 필요이고 항목 4개를 반환한다", () => {
    const r = tagPolicy(익산정책, {
      age: null,
      region: null,
      status: null,
      incomeBracket: null,
    });
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["나이", "지역", "현재 상태", "소득 구간"]);
  });
});

describe("tagPolicy — 해당 없음이 확인 필요보다 우선한다 (PRD F0-5a)", () => {
  it("명확한 불일치와 모름이 함께 있으면 해당 없음", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: 45, region: null });
    expect(r.tag).toBe("해당 없음");
    expect(r.failReasons).toHaveLength(1);
    expect(r.unknownFields).toEqual([]);
  });
});
