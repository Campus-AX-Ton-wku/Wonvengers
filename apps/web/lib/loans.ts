import { loanProductsForRegion } from "./region";
import type { HousingType, LoanProductMeta } from "./types";

/**
 * 대출 · 보증 모아 보기 (docs/기획/2026-11-22-대출보증-모아보기-설계.md §2).
 * 홈 '대출 · 보증' 줄 · /loans · /loans/[id] 가 같이 쓴다. 대출 · 보증은 현금 지원이 아니라
 * 금액 계산에 넣지 않는다 — 여기서는 고르고 줄 세우고 이름 붙이는 일만 한다.
 */

/** 종류 이름 (11/17 결과 화면 접힌 목록에 있던 이름 그대로) */
export const LOAN_TYPE_LABEL: Record<LoanProductMeta["productType"], string> = {
  loan_interest_subsidy: "대출 · 이자 지원",
  guarantee_fee_subsidy: "보증료 지원",
  savings_account: "청약 · 저축",
};

/** "전국" · "전북특별자치도 익산시" → "익산시" — 지역 범위의 마지막 낱말 */
export function loanRegionLabel(product: Pick<LoanProductMeta, "regionScope">): string {
  const words = product.regionScope.trim().split(/\s+/);
  return words[words.length - 1] || product.regionScope;
}

/** 카드 · 상세의 한 줄 — "대출 · 이자 지원 · 익산시" */
export function loanMetaLine(product: LoanProductMeta): string {
  return `${LOAN_TYPE_LABEL[product.productType]} · ${loanRegionLabel(product)}`;
}

/** 집 형태별로 앞에 세울 상품 (이 순서로). 월세 · 연세는 보증부월세, 전세는 전세 대출 둘. */
const HOUSING_FIRST: Partial<Record<HousingType, string[]>> = {
  월세: ["youth-btm-monthly-rent-loan"],
  연세: ["youth-btm-monthly-rent-loan"],
  전세: ["youth-btm-jeonse-loan", "iksan-youth-jeonse-loan-interest"],
};

/**
 * 이 사람에게 보여 줄 대출 · 보증과 순서. 지역 답이 있으면 결과 화면과 같은 규칙(loanProductsForRegion)으로 거르고,
 * 집 형태에 맞는 상품을 앞으로 옮긴다(주거 가이드의 guidesForHousing 과 같은 생각). 옮긴 게 있으면 첫 카드 꼬리표.
 */
export function orderedLoans(
  products: LoanProductMeta[],
  who: { region: string | null; housingType: HousingType | null }
): { loans: LoanProductMeta[]; tag: string | null } {
  const pool = who.region ? loanProductsForRegion(products, who.region) : products;
  const firstIds = (who.housingType && HOUSING_FIRST[who.housingType]) || [];
  const first = firstIds.flatMap((id) => pool.filter((p) => p.id === id));
  if (first.length === 0) return { loans: pool, tag: null };
  const rest = pool.filter((p) => !firstIds.includes(p.id));
  return { loans: [...first, ...rest], tag: `${who.housingType}라면 먼저` };
}

export function findLoan(products: LoanProductMeta[], id: string): LoanProductMeta | undefined {
  return products.find((p) => p.id === id);
}
