import { describe, expect, it } from "vitest";
import policiesData from "@/data/policies.json";
import type { PolicyMeta } from "../types";
import { evaluatePolicy } from "../eligibility";
import { makeListing, makeProfile, OPEN_PERIOD_DAY, TODAY } from "./fixtures";

const policies = policiesData as PolicyMeta[];
const moland = policies.find((p) => p.id === "moland-youth-rent-support")!;
const iksan = policies.find((p) => p.id === "iksan-youth-rent-support")!;
const jeonbuk = policies.find((p) => p.id === "jeonbuk-youth-settlement-support")!;
const iksanMoving = policies.find((p) => p.id === "iksan-newcomer-moving-cost-support")!;
const housingBenefitSplit = policies.find((p) => p.id === "youth-housing-benefit-split-payment")!;
const seoulMoving = policies.find((p) => p.id === "seoul-youth-moving-cost-support")!;

describe("국토부 청년월세 지원", () => {
  it("모든 조건을 충족하면 예상 적용이고, 월 상한×연세 환산월세 중 작은 값 × 개월수로 계산한다", () => {
    const profile = makeProfile();
    const listing = makeListing({ contractType: "연세", rentOrYearlyAmount: 1800000, months: 12 }); // 월 15만원 환산
    const result = evaluatePolicy(moland, profile, listing, OPEN_PERIOD_DAY);

    expect(result.status).toBe("예상적용");
    expect(result.failedLabels).toHaveLength(0);
    expect(result.estimatedAmount).toBe(150000 * 12); // 월세(15만)가 상한(20만)보다 낮음
  });

  it("월세가 월 상한(20만원)보다 높으면 상한으로 캡핑한다", () => {
    const profile = makeProfile();
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12 });
    const result = evaluatePolicy(moland, profile, listing, OPEN_PERIOD_DAY);
    expect(result.estimatedAmount).toBe(200000 * 12);
  });

  it("생애 지원 상한 24개월을 넘는 계약 기간이어도 24개월분까지만 계산한다", () => {
    const profile = makeProfile();
    const listing = makeListing({ contractType: "월세", rentOrYearlyAmount: 200000, months: 30 });
    const result = evaluatePolicy(moland, profile, listing, OPEN_PERIOD_DAY);
    expect(result.estimatedAmount).toBe(200000 * 24);
  });

  it("나이 경계값 19세는 통과, 18세는 탈락한다", () => {
    const listing = makeListing();
    const pass = evaluatePolicy(moland, makeProfile({ birthDate: "2007-04-01" }), listing, OPEN_PERIOD_DAY); // 만 19세
    const fail = evaluatePolicy(moland, makeProfile({ birthDate: "2007-04-02" }), listing, OPEN_PERIOD_DAY); // 만 18세
    expect(pass.status).not.toBe("대상아님");
    expect(fail.status).toBe("대상아님");
  });

  it("무주택이 아니면 대상아님이고, 다른 탈락 사유가 있어도 모두 함께 보여준다 (F3-5)", () => {
    const profile = makeProfile({ hasNoHouse: false, receivingOtherRentSupport: true });
    const result = evaluatePolicy(moland, profile, makeListing(), OPEN_PERIOD_DAY);
    expect(result.status).toBe("대상아님");
    expect(result.failedLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("소득을 모르면 조건 충족 시 가능으로 분류하고 확인 방법을 안내한다 (F3-4)", () => {
    const profile = makeProfile({ ownHouseholdMonthlyIncome: "unknown" });
    const result = evaluatePolicy(moland, profile, makeListing(), OPEN_PERIOD_DAY);
    expect(result.status).toBe("조건충족시가능");
    expect(result.unknownLabels.length).toBeGreaterThan(0);
  });

  it("대상아님·신청불가 정책의 예상액은 0이다 (안전 규칙)", () => {
    const profile = makeProfile({ hasNoHouse: false });
    const result = evaluatePolicy(moland, profile, makeListing(), OPEN_PERIOD_DAY);
    expect(result.estimatedAmount).toBe(0);
  });

  // 2026년 접수는 5/29 에 끝났다. 조건을 다 갖춘 사람에게도 '신청불가'가 나오는 것이
  // 정상이며, 이 사실이 데이터에 남아 있는지 고정해 둔다 (F3-6).
  it("2026년 접수 기간(3/30~5/29)이 끝난 뒤에는 조건을 모두 갖춰도 신청불가다", () => {
    const result = evaluatePolicy(moland, makeProfile(), makeListing(), TODAY);
    expect(result.status).toBe("신청불가");
    expect(result.estimatedAmount).toBe(0);
  });

  it("신청 마감·시작 전이면 신청불가로 분류하고 판정 체크는 수행하지 않는다", () => {
    const before = evaluatePolicy(
      { ...moland, applicationStart: "2027-01-01" },
      makeProfile(),
      makeListing(),
      TODAY
    );
    const after = evaluatePolicy(
      { ...moland, applicationEnd: "2026-01-01" },
      makeProfile(),
      makeListing(),
      TODAY
    );
    expect(before.status).toBe("신청불가");
    expect(after.status).toBe("신청불가");
    expect(before.checks).toHaveLength(0);
  });
});

describe("익산형 청년월세 지원사업 (소득 구간 60~130%)", () => {
  it("본인 가구 소득이 60% 이하이면(국토부 대상) 익산시 사업은 대상아님이다", () => {
    const result = evaluatePolicy(iksan, makeProfile({ ownHouseholdMonthlyIncome: 1000000 }), makeListing(), TODAY);
    expect(result.status).toBe("대상아님");
  });

  it("본인 가구 소득이 60~130% 구간이면 예상 적용이다", () => {
    const result = evaluatePolicy(iksan, makeProfile({ ownHouseholdMonthlyIncome: 2000000 }), makeListing(), TODAY);
    expect(result.status).toBe("예상적용");
  });

  it("130%를 초과하면 대상아님이다", () => {
    const result = evaluatePolicy(iksan, makeProfile({ ownHouseholdMonthlyIncome: 4000000 }), makeListing(), TODAY);
    expect(result.status).toBe("대상아님");
  });
});

describe("전북청년 지역정착 지원사업", () => {
  it("대상 업종 재직 요건을 충족하지 못하면 대상아님이다", () => {
    const result = evaluatePolicy(
      jeonbuk,
      makeProfile({ employedInTargetSectorOver3Months: false }),
      makeListing(),
      OPEN_PERIOD_DAY
    );
    expect(result.status).toBe("대상아님");
  });

  it("모든 요건 충족 시 정액(월 30만원×개월수)을 실제 월세와 무관하게 지급한다", () => {
    const result = evaluatePolicy(
      jeonbuk,
      makeProfile({ ownHouseholdMonthlyIncome: 1000000 }),
      makeListing({ contractType: "월세", rentOrYearlyAmount: 900000, months: 12 }),
      OPEN_PERIOD_DAY
    );
    expect(result.status).toBe("예상적용");
    expect(result.estimatedAmount).toBe(300000 * 12);
  });

  it("2026년 접수 기간(3/6~4/10)이 끝난 뒤에는 조건을 모두 갖춰도 신청불가다", () => {
    const result = evaluatePolicy(
      jeonbuk,
      makeProfile({ ownHouseholdMonthlyIncome: 1000000 }),
      makeListing(),
      TODAY
    );
    expect(result.status).toBe("신청불가");
  });
});

describe("익산시 전입 청년 이사비·중개보수 지원사업", () => {
  it("18~39세면 예상 적용이고, 이사비 실비와 상한(50만원) 중 작은 값을 지급한다", () => {
    const result = evaluatePolicy(
      iksanMoving,
      makeProfile({ birthDate: "2000-01-01" }),
      makeListing({ oneTimeMoveCost: 300000 }),
      TODAY
    );
    expect(result.status).toBe("예상적용");
    expect(result.estimatedAmount).toBe(300000);
  });

  it("이사비 실비가 상한(50만원)을 넘으면 상한으로 캡핑한다", () => {
    const result = evaluatePolicy(
      iksanMoving,
      makeProfile({ birthDate: "2000-01-01" }),
      makeListing({ oneTimeMoveCost: 800000 }),
      TODAY
    );
    expect(result.estimatedAmount).toBe(500000);
  });

  it("만 39세를 초과하면 대상아님이다", () => {
    const result = evaluatePolicy(
      iksanMoving,
      makeProfile({ birthDate: "1985-01-01" }),
      makeListing({ oneTimeMoveCost: 300000 }),
      TODAY
    );
    expect(result.status).toBe("대상아님");
  });
});

describe("청년 주거급여 분리지급", () => {
  it("19~29세, 부모와 별도 거주, 원가구 소득 48% 이하면 예상 적용이다", () => {
    const result = evaluatePolicy(
      housingBenefitSplit,
      makeProfile({ birthDate: "2001-01-01", originHouseholdMonthlyIncome: 1000000 }),
      makeListing({ contractType: "월세", rentOrYearlyAmount: 150000, months: 12 }),
      TODAY
    );
    expect(result.status).toBe("예상적용");
    expect(result.estimatedAmount).toBe(150000 * 12); // 월세(15만)가 4급지 1인 기준임대료(21만 2천)보다 낮음
  });

  it("만 30세 이상이면 대상아님이다", () => {
    const result = evaluatePolicy(
      housingBenefitSplit,
      makeProfile({ birthDate: "1995-01-01", originHouseholdMonthlyIncome: 1000000 }),
      makeListing(),
      TODAY
    );
    expect(result.status).toBe("대상아님");
  });

  it("원가구 소득이 중위 48%를 초과하면 대상아님이다", () => {
    const result = evaluatePolicy(
      housingBenefitSplit,
      makeProfile({ birthDate: "2001-01-01", originHouseholdMonthlyIncome: 3000000 }),
      makeListing(),
      TODAY
    );
    expect(result.status).toBe("대상아님");
  });
});

describe("서울 청년 부동산 중개보수 및 이사비 지원사업 (전국화 Phase 2, 광역 1건째)", () => {
  it("19~39세·무주택·소득기준 충족이면 조건충족시가능이다 — 전입일자·거래금액은 판정하지 않아 확인 필요로 남는다", () => {
    const result = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "2000-01-01" }),
      makeListing({ oneTimeMoveCost: 300000 }),
      OPEN_PERIOD_DAY
    );
    expect(result.status).toBe("조건충족시가능"); // movedInAfter2024·dealAmountUnder200M 가 unknown 이라
    expect(result.failedLabels).toHaveLength(0);
    expect(result.unknownLabels.length).toBeGreaterThanOrEqual(2);
    expect(result.estimatedAmount).toBe(300000); // 실비(30만) < 상한(40만)
  });

  it("이사비·중개보수 실비 합이 상한(40만원)을 넘으면 상한으로 캡핑한다", () => {
    const result = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "2000-01-01" }),
      makeListing({ oneTimeMoveCost: 600000 }),
      OPEN_PERIOD_DAY
    );
    expect(result.estimatedAmount).toBe(400000);
  });

  it("나이 경계값 만 39세는 통과, 만 40세는 대상아님이다", () => {
    const pass = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "1986-04-02" }), // OPEN_PERIOD_DAY(2026-04-01) 기준 생일 하루 전 → 아직 39세
      makeListing({ oneTimeMoveCost: 100000 }),
      OPEN_PERIOD_DAY
    );
    const fail = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "1986-04-01" }), // 생일 당일이라 이미 만 40세
      makeListing({ oneTimeMoveCost: 100000 }),
      OPEN_PERIOD_DAY
    );
    expect(pass.status).not.toBe("대상아님");
    expect(fail.status).toBe("대상아님");
  });

  it("가구 소득이 중위 150%(1인 기준 약 384만 7천원)를 초과하면 대상아님이다", () => {
    const result = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "2000-01-01", ownHouseholdMonthlyIncome: 5000000 }),
      makeListing({ oneTimeMoveCost: 100000 }),
      OPEN_PERIOD_DAY
    );
    expect(result.status).toBe("대상아님");
  });

  it("무주택이 아니면 대상아님이다", () => {
    const result = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "2000-01-01", hasNoHouse: false }),
      makeListing({ oneTimeMoveCost: 100000 }),
      OPEN_PERIOD_DAY
    );
    expect(result.status).toBe("대상아님");
  });

  it("등록된 상반기 신청기간(2026-04-01~04-14) 밖이면 조건을 다 갖춰도 신청불가다 — 하반기 모집이 실제로 있어도 이 앱은 아직 반영하지 못한다", () => {
    const result = evaluatePolicy(
      seoulMoving,
      makeProfile({ birthDate: "2000-01-01" }),
      makeListing({ oneTimeMoveCost: 100000 }),
      TODAY // 2026-08-12, 상반기 종료 후
    );
    expect(result.status).toBe("신청불가");
  });
});
