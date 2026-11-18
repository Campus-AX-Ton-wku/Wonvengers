// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultReceipt } from "@/app/result/ResultReceipt";
import { makeListing } from "@/lib/__tests__/fixtures";

/**
 * 영수증의 한 달 금액 (11/18 진단 2회차 P1). 한 번만 내는 이사비를 12개월로 나눠 '한 달에 약 21만 8천원'으로
 * 보이면, 매달 실제로 나가는 16만 8천원보다 크게 읽힌다 — 매달 나가는 돈과 한 번 내는 돈을 나눠 적는다.
 */
describe("돈 요약 영수증 — 매달 나가는 돈과 한 번 내는 돈", () => {
  const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, managementFee: 30000, months: 12, oneTimeMoveCost: 600000 });

  it("매달 = (월세·관리비 − 매달 받는 지원) ÷ 개월, 이사비는 한 번으로 따로", () => {
    render(
      <ResultReceipt
        listing={listing}
        supportAmount={2544000}
        finalCost={2616000}
        included={[{ id: "split", name: "청년 주거급여 분리지급", amount: 2544000, oneTime: false }]}
        overlapExcluded={[]}
        unknownConditions={[]}
      />
    );
    // (35만 + 3만) × 12 = 456만 − 254만 4천 = 201만 6천 ÷ 12 = 16만 8천
    expect(screen.getByText("매달 약 16만 8,000원 + 이사비 60만원(한 번)")).toBeTruthy();
    expect(screen.queryByText(/한 달에 약/)).toBeNull();
  });

  it("이사비 지원(한 번)은 이사비에서 먼저 뺀다", () => {
    render(
      <ResultReceipt
        listing={listing}
        supportAmount={500000}
        finalCost={5060000}
        included={[{ id: "move", name: "이사비 지원", amount: 500000, oneTime: true }]}
        overlapExcluded={[]}
        unknownConditions={[]}
      />
    );
    // 매달 38만원 그대로, 이사비 60만 − 50만 = 10만원
    expect(screen.getByText("매달 약 38만원 + 이사비 10만원(한 번)")).toBeTruthy();
  });
});
