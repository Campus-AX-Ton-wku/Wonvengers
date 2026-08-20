import { describe, expect, it } from "vitest";
import { tagPolicy } from "@/lib/filter";
import type { DiscoveryAnswers, PolicyMeta } from "@/lib/types";

// 익산시 전용, 만 19~39세, 대학생·재직만, 소득 3구간 이하
const 익산정책: PolicyMeta = {
  id: "test-iksan",
  name: "테스트 익산 월세지원",
  agency: "익산시",
  regionScope: "전북특별자치도 익산시",
  discovery: {
    ageMin: 19,
    ageMax: 39,
    regions: ["전북특별자치도 익산시"],
    statuses: ["대학생", "재직"],
    incomeBracketMax: 3,
  },
  applicationStart: "2026-03-01",
  applicationEnd: "2026-11-30",
  benefitType: "rent_capped_monthly",
  benefitSummary: "월 최대 20만원",
  requiredInputs: [],
  exclusiveGroup: [],
  sourceUrl: "https://example.com",
  applyUrl: "https://example.com",
  verifiedAt: "2026-08-13",
  effectiveYear: 2026,
  notes: "테스트",
};

// 전라북도 전체 대상
const 전북정책: PolicyMeta = {
  ...익산정책,
  id: "test-jeonbuk",
  name: "테스트 전북 주거지원",
  regionScope: "전북특별자치도",
  discovery: { ...익산정책.discovery, regions: ["전북특별자치도"] },
};

const 기본답변: DiscoveryAnswers = {
  age: 22,
  region: "전북특별자치도 익산시",
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
    const r = tagPolicy(익산정책, { ...기본답변, region: "전북특별자치도" });
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

describe("tagPolicy — discovery 미확인 필드는 추정하지 않는다", () => {
  it("statuses 가 null 이면 답을 했어도 확인 필요", () => {
    const 미확인정책: PolicyMeta = {
      ...익산정책,
      discovery: { ...익산정책.discovery, statuses: null },
    };
    const r = tagPolicy(미확인정책, 기본답변);
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["현재 상태"]);
  });

  it("incomeBracketMax 가 null 이면 소득 구간으로 탈락시키지 않는다", () => {
    const 미확인정책: PolicyMeta = {
      ...익산정책,
      discovery: { ...익산정책.discovery, incomeBracketMax: null },
    };
    const r = tagPolicy(미확인정책, { ...기본답변, incomeBracket: 5 });
    expect(r.tag).toBe("확인 필요");
    expect(r.failReasons).toEqual([]);
  });
});

// policies.json 은 사람이 손으로 관리한다. 기준값이 문자열로 들어가거나 빠지면
// NaN 비교는 항상 false 라서, 그냥 두면 자격 없는 사람도 '가능성 있음'이 된다.
// 판단할 수 없을 땐 '확인 필요'가 정직한 답이다.
describe("tagPolicy — 비교할 수 없는 값은 통과시키지 않는다", () => {
  function 나이기준이망가진정책(ageMin: unknown, ageMax: unknown): PolicyMeta {
    return {
      ...익산정책,
      discovery: {
        ...익산정책.discovery,
        ageMin: ageMin as number,
        ageMax: ageMax as number,
      },
    };
  }

  it("정책의 ageMax 가 숫자가 아니면 확인 필요", () => {
    const r = tagPolicy(나이기준이망가진정책(19, "39"), 기본답변);
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["나이"]);
  });

  it("정책의 ageMin 이 빠져 있으면 확인 필요", () => {
    const r = tagPolicy(나이기준이망가진정책(undefined, 39), 기본답변);
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["나이"]);
  });

  it("나이 답변이 NaN 이면 확인 필요", () => {
    const r = tagPolicy(익산정책, { ...기본답변, age: Number.NaN });
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["나이"]);
  });

  it("정책의 incomeBracketMax 가 숫자가 아니면 확인 필요", () => {
    const 망가진정책: PolicyMeta = {
      ...익산정책,
      discovery: { ...익산정책.discovery, incomeBracketMax: "3" as unknown as number },
    };
    const r = tagPolicy(망가진정책, 기본답변);
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["소득 구간"]);
  });

  it("소득 구간 답변이 NaN 이면 확인 필요", () => {
    const r = tagPolicy(익산정책, { ...기본답변, incomeBracket: Number.NaN });
    expect(r.tag).toBe("확인 필요");
    expect(r.unknownFields).toEqual(["소득 구간"]);
  });

  it("비교 불가와 명확한 불일치가 함께 있으면 해당 없음이 우선한다", () => {
    const r = tagPolicy(나이기준이망가진정책(19, "39"), { ...기본답변, status: "구직" });
    expect(r.tag).toBe("해당 없음");
  });
});
