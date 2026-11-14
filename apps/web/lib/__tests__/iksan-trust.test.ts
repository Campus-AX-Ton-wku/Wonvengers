import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import loanJson from "@/data/loan-products.json";
import { loanProductsForRegion, policiesForRegion } from "@/lib/region";
import type { LoanProductMeta, PolicyMeta } from "@/lib/types";

/**
 * 익산의 신뢰 기준. 익산 사용자에게 보이는 모든 항목은
 * 원문 대조일·담당 연락처·실제 신청 페이지를 갖는다.
 *
 * 이 테스트가 깨지면 새로 넣은 항목이 기준을 못 채운 것이다. 기준을 낮추지 말고 데이터를 채운다.
 */
const IKSAN = "전북특별자치도 익산시";
const items = [
  ...policiesForRegion(policiesJson as PolicyMeta[], IKSAN),
  ...loanProductsForRegion(loanJson as LoanProductMeta[], IKSAN),
];

describe("익산 신뢰 기준", () => {
  it("익산 항목이 하나 이상 잡힌다 (지역 문자열 오타 방지)", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it.each(items.map((x) => [x.id, x] as const))("%s — 원문 대조일이 있다", (_, item) => {
    expect(item.verifiedAt).not.toBeNull();
  });

  it.each(items.map((x) => [x.id, x] as const))("%s — 담당 연락처가 있다", (_, item) => {
    expect(item.contact).not.toBeNull();
  });

  it.each(items.map((x) => [x.id, x] as const))("%s — 신청 링크가 홈페이지 첫 화면이 아니다", (_, item) => {
    const url = new URL(item.applyUrl);
    expect(url.pathname === "/" && url.search === "", `${item.applyUrl}`).toBe(false);
  });

  it("데이터 파일 사이에 id 가 겹치지 않는다", () => {
    const ids = [
      ...(policiesJson as PolicyMeta[]).map((x) => x.id),
      ...(loanJson as LoanProductMeta[]).map((x) => x.id),
    ];
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });
});
