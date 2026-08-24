import { describe, expect, it } from "vitest";
import { betterApplyUrl, corroborateWith, formatApplyPeriod } from "@/lib/youth-index";
import type { PolicyMeta, YouthPolicyIndex, YouthPolicyRecord } from "@/lib/types";

function makeRecord(overrides: Partial<YouthPolicyRecord> = {}): YouthPolicyRecord {
  return {
    plcyNo: "20260326005400212297",
    name: "익산형 청년월세 지원사업",
    agency: "전북특별자치도 익산시",
    largeCategory: "주거",
    mediumCategory: "전월세 및 주거급여 지원",
    applyPeriod: "20260415 ~ 20260930",
    applyUrl: null,
    referenceUrl: null,
    ageMin: 19,
    ageMax: 34,
    ageUnlimited: false,
    supportScale: 230,
    firstComeFirstServed: false,
    lastModifiedAt: "2026-06-05 16:49:04",
    mismatches: [],
    ...overrides,
  };
}

function makeIndex(records: Record<string, YouthPolicyRecord>): YouthPolicyIndex {
  return {
    source: "온통청년 청년정책 API (getPlcy)",
    sourceUrl: "https://example.com",
    fetchedAt: "2026-08-24",
    note: "테스트",
    records,
  };
}

function makePolicy(overrides: Partial<PolicyMeta> = {}): PolicyMeta {
  return {
    id: "test-policy",
    discovery: {
      ageMin: 19,
      ageMax: 34,
      regions: ["전국"],
      statuses: null,
      incomeBracketMin: null,
      incomeBracketMax: null,
    },
    name: "테스트 정책",
    agency: "익산시",
    regionScope: "전북특별자치도 익산시",
    applicationStart: "2026-04-15",
    applicationEnd: "2026-09-30",
    benefitType: "rent_capped_monthly",
    benefitSummary: "월 최대 20만원",
    requiredInputs: [],
    exclusiveGroup: [],
    sourceUrl: "https://example.com",
    applyUrl: "https://www.iksan.go.kr",
    youthPolicyNo: "20260326005400212297",
    verifiedAt: null,
    effectiveYear: 2026,
    notes: "",
    ...overrides,
  };
}

describe("corroborateWith — 대조 상태 판정", () => {
  it("youthPolicyNo 가 null 이면 미등록", () => {
    const r = corroborateWith(makePolicy({ youthPolicyNo: null }), makeIndex({}));
    expect(r.state).toBe("미등록");
    expect(r.record).toBeNull();
  });

  it("youthPolicyNo 가 있어도 색인에 없으면 미등록으로 처리한다", () => {
    // 스크립트를 안 돌렸거나 조회에 실패한 상태다. 여기서 '일치'라고 하면 거짓이 된다.
    const r = corroborateWith(makePolicy(), makeIndex({}));
    expect(r.state).toBe("미등록");
  });

  it("불일치 항목이 없으면 일치", () => {
    const record = makeRecord({ mismatches: [] });
    const r = corroborateWith(makePolicy(), makeIndex({ [record.plcyNo]: record }));
    expect(r.state).toBe("일치");
    expect(r.record?.name).toBe("익산형 청년월세 지원사업");
  });

  it("불일치 항목이 하나라도 있으면 불일치", () => {
    const record = makeRecord({ mismatches: ["신청 종료일: 앱 2026-12-31 / 온통청년 2026-09-30"] });
    const r = corroborateWith(makePolicy(), makeIndex({ [record.plcyNo]: record }));
    expect(r.state).toBe("불일치");
    expect(r.record?.mismatches).toHaveLength(1);
  });

  it("색인의 조회일을 그대로 전달한다", () => {
    const r = corroborateWith(makePolicy({ youthPolicyNo: null }), makeIndex({}));
    expect(r.fetchedAt).toBe("2026-08-24");
  });
});

describe("formatApplyPeriod", () => {
  it("시작·종료 8자리를 ISO 형태로 바꾼다", () => {
    expect(formatApplyPeriod("20260415 ~ 20260930")).toBe("2026-04-15 ~ 2026-09-30");
  });

  it("날짜가 하나면 종료일을 미기재로 표시한다", () => {
    expect(formatApplyPeriod("20260415")).toBe("2026-04-15 ~ 미기재");
  });

  it("null 은 null 로 둔다", () => {
    expect(formatApplyPeriod(null)).toBeNull();
  });

  it("날짜 형식이 아니면 원문을 그대로 준다", () => {
    expect(formatApplyPeriod("예산 소진 시까지")).toBe("예산 소진 시까지");
  });
});

describe("betterApplyUrl — 더 구체적인 신청 링크만 고른다", () => {
  it("기록이 없으면 null", () => {
    expect(betterApplyUrl(makePolicy(), null)).toBeNull();
  });

  it("도메인 루트는 앱이 가진 것보다 나을 게 없으므로 버린다", () => {
    const record = makeRecord({ applyUrl: "https://bokjiro.go.kr" });
    expect(betterApplyUrl(makePolicy(), record)).toBeNull();
  });

  it("앱의 applyUrl 과 같으면 중복이므로 버린다", () => {
    const record = makeRecord({ applyUrl: "https://www.iksan.go.kr" });
    expect(betterApplyUrl(makePolicy(), record)).toBeNull();
  });

  it("경로가 있는 주소는 채택한다", () => {
    const deep =
      "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=WLF00003201";
    const record = makeRecord({ applyUrl: deep });
    expect(betterApplyUrl(makePolicy(), record)).toBe(deep);
  });

  it("applyUrl 이 없으면 referenceUrl 로 대체한다", () => {
    const record = makeRecord({
      applyUrl: null,
      referenceUrl: "https://youth.example.go.kr/policy/123",
    });
    expect(betterApplyUrl(makePolicy(), record)).toBe("https://youth.example.go.kr/policy/123");
  });

  it("주소 형식이 깨져 있으면 버린다", () => {
    const record = makeRecord({ applyUrl: "홈페이지 참조" });
    expect(betterApplyUrl(makePolicy(), record)).toBeNull();
  });
});
