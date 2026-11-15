import { describe, expect, it } from "vitest";
import policiesData from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import { buildCalculationSummary, summaryHighlights } from "@/lib/summary";
import { makeListing, makeProfile, OPEN_PERIOD_DAY } from "./fixtures";

const policies = policiesData as PolicyMeta[];

/**
 * F4-11 요약 화면과 F4-4 결과 상단은 같은 값을 보여줘야 한다. 두 화면이 각자
 * 파생하면 캡처한 요약과 상세 화면의 숫자가 어긋난다.
 */
describe("summaryHighlights", () => {
  const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12 });

  it("최대 지원 가능액을 구성한 정책만 이름과 금액으로 뽑는다", () => {
    const summary = buildCalculationSummary(policies, makeProfile(), listing, OPEN_PERIOD_DAY);
    const { included } = summaryHighlights(summary);

    expect(included.length).toBeGreaterThan(0);
    for (const item of included) {
      expect(summary.bestCombination.includedPolicyIds).toContain(item.id);
      expect(item.name).toBeTruthy();
    }
  });

  it("뽑은 금액의 합이 최대 지원 가능액과 같다", () => {
    const summary = buildCalculationSummary(policies, makeProfile(), listing, OPEN_PERIOD_DAY);
    const { included } = summaryHighlights(summary);
    const sum = included.reduce((acc, i) => acc + i.amount, 0);
    expect(sum).toBe(summary.maxSupportAmount);
  });

  it("조합에 들어간 '조건 충족 시 가능' 정책의 미확인 조건만 모은다 (F4-8)", () => {
    const summary = buildCalculationSummary(
      policies,
      makeProfile({ ownHouseholdMonthlyIncome: "unknown" }),
      listing,
      OPEN_PERIOD_DAY
    );
    const { unknownConditions } = summaryHighlights(summary);

    expect(unknownConditions.length).toBeGreaterThan(0);
    for (const u of unknownConditions) {
      expect(summary.bestCombination.includedPolicyIds).toContain(u.policyId);
      expect(u.label).toBeTruthy();
    }
  });

  it("판정 질문을 다 채우면 최선 조합에 미확인 조건이 남지 않는다", () => {
    // 2026-11-15 목표 지역을 익산시로 줄인 뒤, 결과 화면에서 직접 답하는 조건(selfDeclared)은
    // 익산 전입 지원 2건에만 있다. 둘 다 정액이라 예상액이 0원이고 최선 조합에 들지 않는다.
    // (직접 답하는 조건이 답 전까지 미확인으로 남는 것은 eligibility.test.ts 의 익산 전입 지원 테스트가 본다)
    const summary = buildCalculationSummary(policies, makeProfile(), listing, OPEN_PERIOD_DAY);
    const { unknownConditions } = summaryHighlights(summary);
    expect(unknownConditions).toEqual([]);
  });

  it("받을 수 있는 정책이 없으면 빈 목록이고 0원이다", () => {
    const summary = buildCalculationSummary(
      policies,
      // 나이를 모든 정책의 상한(가장 넓은 건 괴산군의 49세) 위로 두고 무주택도
      // 아니게 해서, 조건이 넓은 정책까지 포함해 전부 탈락시킨다.
      makeProfile({ hasNoHouse: false, birthDate: "1960-01-01" }),
      listing,
      OPEN_PERIOD_DAY
    );
    const { included, unknownConditions } = summaryHighlights(summary);
    expect(included).toEqual([]);
    expect(unknownConditions).toEqual([]);
    expect(summary.maxSupportAmount).toBe(0);
  });
});
