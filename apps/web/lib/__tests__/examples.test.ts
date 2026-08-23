import { describe, expect, it } from "vitest";
import examplesJson from "@/data/example-listings.json";
import type { ExampleListing } from "@/lib/types";
import { exampleBadge, exampleToListing, isVerifiedExample } from "@/lib/examples";
import { makeListing } from "./fixtures";

const examples = examplesJson as ExampleListing[];

const 가상예시: ExampleListing = {
  id: "test-fake",
  label: "테스트 원룸 · 월세",
  sourceKind: "가상 예시",
  verifiedAt: null,
  note: "시연용 가상 조건",
  listing: {
    region: "전북특별자치도 익산시",
    contractType: "월세",
    deposit: 3000000,
    rentOrYearlyAmount: 350000,
    managementFee: 50000,
    oneTimeMoveCost: 300000,
    months: 12,
  },
};

// F1-11: 예시 매물은 팀이 직접 확인한 고정 데이터여야 하고, 실제 매물·실거래
// 사례인지 화면에 표시해야 한다. 확인 전 데이터가 실제 매물처럼 보이면 안 된다.
describe("example-listings.json", () => {
  it("예시가 1건 이상 있고 id 가 겹치지 않는다", () => {
    expect(examples.length).toBeGreaterThan(0);
    expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length);
  });

  it("모든 예시에 출처 구분과 설명이 있다", () => {
    for (const e of examples) {
      expect(["가상 예시", "실제 매물", "실거래 사례"], e.id).toContain(e.sourceKind);
      expect(e.note, `${e.id}: note 없음`).toBeTruthy();
      expect(e.label, `${e.id}: label 없음`).toBeTruthy();
    }
  });

  it("모든 예시가 지역 선택지와 같은 어휘를 쓰고 금액이 음수가 아니다", () => {
    for (const e of examples) {
      expect(e.listing.region, e.id).toBeTruthy();
      expect(e.listing.months, e.id).toBeGreaterThan(0);
      for (const amount of [
        e.listing.deposit,
        e.listing.rentOrYearlyAmount,
        e.listing.managementFee,
        e.listing.oneTimeMoveCost,
      ]) {
        expect(amount, e.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("확인되지 않은 예시는 '실제 매물'로 표시되지 않는다", () => {
    for (const e of examples) {
      if (e.verifiedAt === null) expect(e.sourceKind, e.id).toBe("가상 예시");
    }
  });
});

describe("exampleToListing", () => {
  it("예시 값으로 입력을 채운다", () => {
    const filled = exampleToListing(가상예시, makeListing());
    expect(filled.deposit).toBe(3000000);
    expect(filled.rentOrYearlyAmount).toBe(350000);
    expect(filled.contractType).toBe("월세");
    expect(filled.region).toBe("전북특별자치도 익산시");
  });

  it("어느 예시에서 왔는지 남긴다", () => {
    expect(exampleToListing(가상예시, makeListing()).exampleId).toBe("test-fake");
  });

  it("입력 출처를 '예시 데이터'로 바꾼다 — 중개사 안내라고 우기지 않는다", () => {
    const filled = exampleToListing(가상예시, makeListing({ sourceType: "중개사 안내" }));
    expect(filled.sourceType).toBe("예시 데이터");
  });

  // 이 체크박스는 사용자 본인의 확인이다. 예시를 불러왔다고 대신 켜주면 안 된다.
  it("'실제 계약 조건과 일치' 확인은 켜지 않는다", () => {
    const filled = exampleToListing(가상예시, makeListing({ confirmedMatchesActualContract: true }));
    expect(filled.confirmedMatchesActualContract).toBe(false);
  });

  // 고정된 날짜를 박아두면 시간이 지나 과거 날짜가 된다. 사용자가 직접 고르게 한다.
  it("계약 시작 예정일은 사용자가 넣은 값을 그대로 둔다", () => {
    const filled = exampleToListing(가상예시, makeListing({ contractStartDate: "2026-09-01" }));
    expect(filled.contractStartDate).toBe("2026-09-01");
  });
});

describe("exampleBadge / isVerifiedExample", () => {
  it("가상 예시는 실제 매물이 아니라고 못 박는다", () => {
    expect(exampleBadge(가상예시)).toBe("가상 예시 · 실제 매물이 아닙니다");
    expect(isVerifiedExample(가상예시)).toBe(false);
  });

  it("팀이 확인한 실제 매물은 확인 날짜를 함께 보여준다", () => {
    const 실물: ExampleListing = { ...가상예시, sourceKind: "실제 매물", verifiedAt: "2026-08-23" };
    expect(exampleBadge(실물)).toBe("실제 매물 · 2026-08-23 확인");
    expect(isVerifiedExample(실물)).toBe(true);
  });

  it("출처 구분이 있어도 확인 날짜가 없으면 미확인으로 다룬다", () => {
    const 미확인: ExampleListing = { ...가상예시, sourceKind: "실거래 사례", verifiedAt: null };
    expect(exampleBadge(미확인)).toBe("실거래 사례 · 확인 전 (미검증)");
    expect(isVerifiedExample(미확인)).toBe(false);
  });
});
