import { describe, expect, it } from "vitest";
import loanProductsData from "@/data/loan-products.json";
import { LOAN_TYPE_LABEL, findLoan, loanMetaLine, loanRegionLabel, orderedLoans } from "../loans";
import type { LoanProductMeta } from "../types";

const products = loanProductsData as LoanProductMeta[];
const ids = (list: LoanProductMeta[]) => list.map((p) => p.id);
const IKSAN = "전북특별자치도 익산시";

describe("대출 · 보증 이름", () => {
  it("종류 · 지역 · 한 줄", () => {
    expect(LOAN_TYPE_LABEL).toEqual({ loan_interest_subsidy: "대출 · 이자 지원", guarantee_fee_subsidy: "보증료 지원", savings_account: "청약 · 저축" });
    expect(loanRegionLabel({ regionScope: "전국" })).toBe("전국");
    expect(loanRegionLabel({ regionScope: "전북특별자치도 익산시" })).toBe("익산시");
    expect(loanMetaLine(findLoan(products, "iksan-youth-jeonse-loan-interest")!)).toBe("대출 · 이자 지원 · 익산시");
    expect(loanMetaLine(findLoan(products, "youth-dream-savings-account")!)).toBe("청약 · 저축 · 전국");
    expect(findLoan(products, "nope")).toBeUndefined();
  });
});

describe("orderedLoans — 고르기 · 순서", () => {
  it("답이 없으면 전부, 데이터 순서, 꼬리표 없음", () => {
    expect(orderedLoans(products, { region: null, housingType: null })).toEqual({ loans: products, tag: null });
  });

  it("월세 · 연세 — 보증부월세대출이 맨 앞, 나머지는 데이터 순서", () => {
    for (const housingType of ["월세", "연세"] as const) {
      const { loans, tag } = orderedLoans(products, { region: IKSAN, housingType });
      expect(ids(loans)).toEqual(["youth-btm-monthly-rent-loan", ...ids(products).filter((id) => id !== "youth-btm-monthly-rent-loan")]);
      expect(tag).toBe(`${housingType}라면 먼저`);
    }
  });

  it("전세 — 버팀목 전세 · 익산 전세 이자가 이 순서로 앞", () => {
    const first = ["youth-btm-jeonse-loan", "iksan-youth-jeonse-loan-interest"];
    const { loans, tag } = orderedLoans(products, { region: IKSAN, housingType: "전세" });
    expect(ids(loans)).toEqual([...first, ...ids(products).filter((id) => !first.includes(id))]);
    expect(tag).toBe("전세라면 먼저");
  });

  it("그 외 — 데이터 순서, 꼬리표 없음", () => {
    expect(orderedLoans(products, { region: IKSAN, housingType: "그 외" })).toEqual({ loans: products, tag: null });
  });

  it("지역 답이 있으면 결과 화면과 같은 규칙으로 거른다 — 익산 밖이면 전국 상품만", () => {
    const { loans } = orderedLoans(products, { region: "그 외 지역", housingType: null });
    expect(loans.length).toBeGreaterThan(0);
    expect(loans.every((p) => p.regionScope === "전국")).toBe(true);
  });

  it("앞으로 옮길 상품이 없으면 꼬리표도 없다", () => {
    const without = products.filter((p) => p.id !== "youth-btm-monthly-rent-loan");
    expect(orderedLoans(without, { region: null, housingType: "월세" })).toEqual({ loans: without, tag: null });
  });
});
