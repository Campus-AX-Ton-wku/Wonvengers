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

  it("이 앱이 물어볼 수 있는 조건은 다 확인돼도, 아예 안 묻는 조건이 있는 정책은 미확인으로 남는다", () => {
    // 괴산군 청년취업자·청년농업인 주거비 지원은 '관내 취업·농업경영체 등록
    // 5년 이내'를 이 앱이 입력받지 않아, EligibilityProfile을 다 채워도 이
    // 조건만은 항상 미확인이다(policy-rules.ts의 goesanYouthWorkerFarmerHousingCost 참고).
    const summary = buildCalculationSummary(policies, makeProfile(), listing, OPEN_PERIOD_DAY);
    const { unknownConditions } = summaryHighlights(summary);
    expect(unknownConditions).toEqual([
      {
        policyId: "goesan-youth-worker-farmer-housing-cost-support",
        policy: "청년취업자 및 청년농업인 주거비 지원",
        label:
          "괴산군 관내 기업 취업 또는 농업경영체 등록 5년 이내 (확인 방법: 재직증명서·농업경영체등록확인서로 확인하세요. 이 앱은 취업·창업 이력을 입력받지 않습니다.)",
      },
    ]);
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
