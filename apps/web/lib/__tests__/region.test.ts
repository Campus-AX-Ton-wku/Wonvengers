import { describe, expect, it } from "vitest";
import {
  REGION_HIERARCHY,
  REGION_OPTIONS,
  isRegionValue,
  policiesForRegion,
  policyAppliesToRegion,
} from "@/lib/region";
import type { PolicyMeta } from "@/lib/types";

/**
 * REGION_OPTIONS 가 REGION_HIERARCHY 계층 구조로 바뀌었다 (전국화 Phase 0).
 * 이 테스트는 두 가지를 고정한다:
 *
 *  1. 기존 3개 선택지(값·순서·라벨)가 리팩터링 전과 완전히 같다 — 저장된 익산
 *     사용자의 answers.region 문자열, find.test.tsx 의 버튼 라벨 텍스트,
 *     policyAppliesToRegion 의 매칭 규칙이 전부 이 값에 기대고 있다.
 *  2. REGION_HIERARCHY 에 시도를 추가하면 REGION_OPTIONS 가 그 값을 그대로
 *     반영한다 — 향후 지역을 늘릴 때 "이 파일만 고치면 된다"는 것을 보장한다.
 */
describe("지역 선택지 계층 구조", () => {
  it("REGION_OPTIONS 는 리팩터링 전과 값·순서가 동일하다", () => {
    expect(REGION_OPTIONS).toEqual([
      { value: "전북특별자치도 익산시", label: "전북특별자치도 익산시", chipLabel: "익산시" },
      { value: "전북특별자치도", label: "전북특별자치도 (익산시 외)", chipLabel: "전북 (익산시 외)" },
      { value: "그 외 지역", label: "그 외 지역 (전국 정책만 해당)", chipLabel: "그 외 지역" },
    ]);
  });

  it("REGION_OPTIONS 는 REGION_HIERARCHY 를 [시군구..., catchAll] 순으로 펼치고 '그 외 지역'을 마지막에 붙인 것과 같다", () => {
    const expected = [
      ...REGION_HIERARCHY.flatMap((p) => [...p.districts, p.catchAll]),
      REGION_OPTIONS[REGION_OPTIONS.length - 1], // '그 외 지역' — 시도 어디에도 없다
    ];
    expect(REGION_OPTIONS).toEqual(expected);
    expect(REGION_OPTIONS[REGION_OPTIONS.length - 1].value).toBe("그 외 지역");
  });

  it("모든 시도의 catchAll.value 는 시도 정식명과 같다 — 시도 단위 정책이 이 값으로 매칭된다", () => {
    for (const province of REGION_HIERARCHY) {
      expect(province.catchAll.value).toBe(province.name);
    }
  });

  it("모든 시군구의 value 는 소속 시도 이름으로 시작한다 — 상위 지자체 매칭(policyAppliesToRegion)이 깨지지 않는다", () => {
    for (const province of REGION_HIERARCHY) {
      for (const district of province.districts) {
        expect(district.value.startsWith(province.name)).toBe(true);
      }
    }
  });

  it("REGION_OPTIONS 안에 값 중복이 없다", () => {
    const values = REGION_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("isRegionValue", () => {
  it("기존 익산 사용자의 저장값을 그대로 인식한다", () => {
    expect(isRegionValue("전북특별자치도 익산시")).toBe(true);
    expect(isRegionValue("전북특별자치도")).toBe(true);
    expect(isRegionValue("그 외 지역")).toBe(true);
  });

  it("선택지에 없는 자유 입력은 걸러낸다", () => {
    expect(isRegionValue("익산")).toBe(false);
    expect(isRegionValue("서울특별시")).toBe(false);
    expect(isRegionValue("")).toBe(false);
  });
});

describe("policyAppliesToRegion — 회귀 확인", () => {
  it("전국 정책은 어떤 지역 값에도 적용된다", () => {
    expect(policyAppliesToRegion("전국", "전북특별자치도 익산시")).toBe(true);
    expect(policyAppliesToRegion("전국", "그 외 지역")).toBe(true);
  });

  it("시군구 사용자는 소속 시도 정책도 받는다", () => {
    expect(policyAppliesToRegion("전북특별자치도", "전북특별자치도 익산시")).toBe(true);
  });

  it("시도(익산시 외) 사용자는 시군구 전용 정책을 받지 않는다", () => {
    expect(policyAppliesToRegion("전북특별자치도 익산시", "전북특별자치도")).toBe(false);
  });

  it("지역이 없으면(빈 문자열) 전국 정책 외에는 적용되지 않는다", () => {
    expect(policyAppliesToRegion("전북특별자치도", "")).toBe(false);
  });
});

describe("policiesForRegion — 회귀 확인", () => {
  const 전국정책: PolicyMeta = {
    id: "test-national",
    name: "테스트 전국 정책",
    agency: "국토교통부",
    regionScope: "전국",
    discovery: {
      ageMin: null,
      ageMax: null,
      regions: ["전국"],
      statuses: null,
      incomeBracketMin: null,
      incomeBracketMax: null,
      housingTypes: null,
    },
    applicationStart: "2026-01-01",
    applicationEnd: null,
    benefitType: "flat_monthly",
    benefitSummary: "테스트",
    requiredInputs: [],
    exclusiveGroup: [],
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com",
    youthPolicyNo: null,
    gov24ServiceId: null,
    verifiedAt: "2026-01-01",
    effectiveYear: 2026,
    notes: "테스트",
  };

  it("등록된 시도가 하나도 없는 '그 외 지역' 사용자도 전국 정책은 받는다", () => {
    const ids = policiesForRegion([전국정책], "그 외 지역").map((p) => p.id);
    expect(ids).toContain("test-national");
  });
});
