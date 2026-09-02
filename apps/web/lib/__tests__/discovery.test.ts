import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import bracketsJson from "@/data/income-brackets.json";
import {
  answerLine,
  answerSummary,
  cardStatus,
  applicationOpenCount,
  splitByApplicationWindow,
  candidateCount,
  groupPolicies,
} from "@/lib/discovery";
import type { IncomeBracket, PolicyMeta, ResolvedAnswers, TagResult } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];
const brackets = bracketsJson as IncomeBracket[];

const 익산_대학생: ResolvedAnswers = {
  age: 23,
  region: "전북특별자치도 익산시",
  status: "대학생",
  incomeBracket: 1,
  housingType: "월세",
};

// 질문 화면과 목록 화면이 같은 분류를 써야 한다. 두 곳에서 따로 계산하면
// CTA 의 건수와 목록의 건수가 어긋난다.
describe("groupPolicies", () => {
  it("정책을 태그별 세 그룹으로 나누고, 어느 그룹에서도 빠뜨리지 않는다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(g.가능.length + g.확인.length + g.해당없음.length).toBe(policies.length);
  });

  it("익산 23세 월세 거주 대학생·소득 1구간의 분류", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(g.가능.map((t) => t.policy.id)).toEqual([
      "moland-youth-rent-support",
      "iksan-newcomer-moving-cost-support",
    ]);
    expect(g.확인.map((t) => t.policy.id)).toEqual(["youth-housing-benefit-split-payment"]);
    // 보증료 지원은 전세 계약자만 받는다 — 월세 거주자에게는 해당 없음이다.
    expect(g.해당없음.map((t) => t.policy.id)).toEqual([
      "iksan-youth-rent-support",
      "jeonbuk-youth-settlement-support",
      "jeonse-return-guarantee-fee-subsidy",
      "seoul-youth-moving-cost-support",
      "ulsan-youth-household-housing-cost-support",
      "incheon-youth-monthly-rent-support-35to39",
      "incheon-brokerage-fee-1000won",
      "jeju-youth-hope-charge-monthly-rent-35to39",
      "jeju-brokerage-fee-support",
      "jeju-youth-moving-cost-support",
      "busan-youth-brokerage-moving-cost-support",
      "sejong-youth-rent-support",
      "incheon-junggu-moving-cost-support",
      "incheon-donggu-welcome-pay",
      "gwangju-seogu-brokerage-fee-1000won",
      "incheon-yeongjonggu-moving-cost-support",
      "pyeongtaek-youth-rent-support",
      "eumseong-youth-rent-support",
      "gumi-youth-rent-support",
      "goryeong-youth-rent-support",
      "incheon-jemulpogu-welcome-pay",
      "goesan-youth-worker-farmer-housing-cost-support",
      "hadong-youth-housing-cost-support",
      "sancheong-youth-rent-support",
      "hapcheon-youth-rent-support",
      "tongyeong-youth-settlement-support",
      "changwon-youth-rent-support",
      "yongin-brokerage-moving-cost-support",
      "namhae-youth-rent-support",
    ]);
  });

  it("아무것도 답하지 않으면 해당 없음이 하나도 없다", () => {
    const g = groupPolicies(policies, { age: null, region: null, status: null, incomeBracket: null, housingType: null });
    expect(g.해당없음).toHaveLength(0);
    expect(g.확인).toHaveLength(policies.length);
  });
});

describe("candidateCount", () => {
  it("CTA 에 쓰는 건수는 가능 + 확인 필요다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(candidateCount(g)).toBe(g.가능.length + g.확인.length);
  });

  it("해당 없음만 남으면 0건이다", () => {
    const g = groupPolicies(policies, { ...익산_대학생, age: 60 });
    expect(candidateCount(g)).toBe(0);
  });
});

// 목록 화면 상단에 "무엇을 답해서 이 결과가 나왔는지"를 보여주는 칩.
describe("answerSummary", () => {
  it("답변한 항목을 사람이 읽는 문구로 만든다", () => {
    expect(answerSummary(익산_대학생, brackets)).toEqual([
      "23세",
      "익산시",
      "대학생",
      "월 100만원 이하",
    ]);
  });

  it("답하지 않은 항목은 '모름'으로 남긴다", () => {
    expect(answerSummary({ age: null, region: null, status: null, incomeBracket: null, housingType: null }, brackets)).toEqual([
      "나이 모름",
      "지역 모름",
      "상태 모름",
      "소득 모름",
    ]);
  });

  it("지역은 선택지와 같은 어휘의 짧은 이름을 쓴다", () => {
    const 도전체 = answerSummary({ ...익산_대학생, region: "전북특별자치도" }, brackets);
    expect(도전체[1]).toBe("전북 (익산시 외)");
  });

  it("소득 구간 번호가 표에 없으면 '소득 모름'으로 둔다", () => {
    const summary = answerSummary({ ...익산_대학생, incomeBracket: 99 }, brackets);
    expect(summary[3]).toBe("소득 모름");
  });
});

/**
 * 1층 태그는 나이·지역·상태·소득만 본다. 접수가 끝난 정책도 '가능성 있음' 이 되므로,
 * 건수만 크게 말하면 "지금 신청할 수 있는 게 3건" 으로 읽힌다. 실제로는 2건이
 * 마감이었을 수 있다 — 헤드라인 숫자가 카드보다 먼저 읽히기 때문에 나눠서 센다.
 */
describe("applicationOpenCount", () => {
  const 익산_대학생: ResolvedAnswers = {
    age: 23,
    region: "전북특별자치도 익산시",
    status: "대학생",
    incomeBracket: 1,
    // 주거형태를 고정한다. null 이면 주거형태 제한이 있는 정책이 '확인 필요'로
    // 남아, '전부 해당 없음' 을 전제한 검증이 성립하지 않는다.
    housingType: "월세",
  };

  it("접수 기간 안에 있는 후보만 센다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    const 마감후 = applicationOpenCount(g, "2026-08-23");
    const 접수중 = applicationOpenCount(g, "2026-04-01");

    expect(접수중).toBeGreaterThan(마감후);
    expect(마감후).toBeLessThanOrEqual(candidateCount(g));
  });

  it("접수 시작 전인 정책도 세지 않는다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(applicationOpenCount(g, "2025-01-01")).toBe(0);
  });

  it("'해당 없음' 은 접수 중이어도 세지 않는다", () => {
    const g = groupPolicies(policies, { ...익산_대학생, age: 60 });
    expect(candidateCount(g)).toBe(0);
    expect(applicationOpenCount(g, "2026-04-01")).toBe(0);
  });
});

/**
 * 후보를 '지금 신청할 수 있는 것'과 '이번 회차가 끝난 것'으로 가른다.
 *
 * 접수가 끝난 정책을 목록에서 지우지는 않는다 — 국토부 청년월세처럼 다음 회차에
 * 다시 열리는 사업이라, 없애면 "그런 지원금이 아예 없다"로 읽혀 또 다른 거짓이 된다.
 * 대신 숫자와 순서에서 섞이지 않게 갈라 둔다.
 */
describe("splitByApplicationWindow", () => {
  const 익산_대학생: ResolvedAnswers = {
    age: 23,
    region: "전북특별자치도 익산시",
    status: "대학생",
    incomeBracket: 1,
    // 주거형태를 고정한다. null 이면 주거형태 제한이 있는 정책이 '확인 필요'로
    // 남아, '전부 해당 없음' 을 전제한 검증이 성립하지 않는다.
    housingType: "월세",
  };

  it("접수가 끝난 후보를 신청 가능한 쪽에서 빼낸다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    const { 신청가능, 마감 } = splitByApplicationWindow(g, "2026-08-23");

    expect(마감.map((t) => t.policy.id)).toContain("moland-youth-rent-support");
    expect(신청가능.map((t) => t.policy.id)).not.toContain("moland-youth-rent-support");
  });

  it("후보를 하나도 잃거나 중복시키지 않는다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    const { 신청가능, 마감 } = splitByApplicationWindow(g, "2026-08-23");

    expect(신청가능.length + 마감.length).toBe(candidateCount(g));
    const ids = [...신청가능, ...마감].map((t) => t.policy.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("접수 시작 전인 정책도 마감 쪽으로 보낸다 — 지금 신청할 수 없는 건 같다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    const { 신청가능 } = splitByApplicationWindow(g, "2025-01-01");

    expect(신청가능).toHaveLength(0);
  });

  it("'해당 없음' 은 어느 쪽에도 넣지 않는다", () => {
    const g = groupPolicies(policies, { ...익산_대학생, age: 60 });
    const { 신청가능, 마감 } = splitByApplicationWindow(g, "2026-04-01");

    expect(신청가능).toHaveLength(0);
    expect(마감).toHaveLength(0);
  });

  it("applicationOpenCount 와 어긋나지 않는다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    for (const asOf of ["2025-01-01", "2026-04-01", "2026-08-23"]) {
      expect(splitByApplicationWindow(g, asOf).신청가능).toHaveLength(
        applicationOpenCount(g, asOf)
      );
    }
  });
});

describe("answerLine", () => {
  it("나이 · 지역 · 상태를 한 줄로 잇는다", () => {
    expect(answerLine(익산_대학생)).toBe("23세 · 익산시 · 대학생");
  });

  // 소득은 이 줄에 두지 않는다 — '조건 수정' 화면에 그대로 있다.
  it("소득 구간은 넣지 않는다", () => {
    expect(answerLine({ ...익산_대학생, incomeBracket: 5 })).toBe("23세 · 익산시 · 대학생");
  });

  it("답하지 않은 항목은 '모름'으로 남긴다", () => {
    expect(answerLine({ age: null, region: null, status: null, incomeBracket: null, housingType: null })).toBe(
      "나이 모름 · 지역 모름 · 상태 모름"
    );
  });

  it("칩 목록과 같은 어휘를 쓴다", () => {
    expect(answerSummary(익산_대학생, brackets).slice(0, 3).join(" · ")).toBe(
      answerLine(익산_대학생)
    );
  });
});

/**
 * 태그와 접수 기간을 사용자가 할 행동 하나로 합친다. 새로 판정하지 않는다 —
 * 우선순위만 정한다: 대상이 아니면 기간을 볼 필요가 없고, 기간 밖이면 남은
 * 조건을 확인해도 지금은 신청할 수 없다.
 */
describe("cardStatus", () => {
  const 정책 = (over: Partial<PolicyMeta>) =>
    ({ applicationStart: "2026-01-01", applicationEnd: "2026-12-31", ...over }) as PolicyMeta;
  const 태그 = (tag: TagResult["tag"]): TagResult => ({
    tag,
    failReasons: [],
    unknownFields: [],
  });

  it("접수 중이고 조건이 맞으면 '신청 가능'", () => {
    expect(cardStatus(정책({}), 태그("가능성 있음"), "2026-06-01")).toBe("신청 가능");
  });

  it("모름이 남아 있으면 '확인 필요'", () => {
    expect(cardStatus(정책({}), 태그("확인 필요"), "2026-06-01")).toBe("확인 필요");
  });

  it("접수 시작 전이면 '신청 예정'", () => {
    expect(cardStatus(정책({}), 태그("가능성 있음"), "2025-12-31")).toBe("신청 예정");
  });

  it("접수가 끝났으면 '접수 마감'", () => {
    expect(cardStatus(정책({}), 태그("가능성 있음"), "2027-01-01")).toBe("접수 마감");
  });

  it("마감일이 없으면 상시 접수다 — 언제 봐도 마감이 아니다", () => {
    expect(cardStatus(정책({ applicationEnd: null }), 태그("가능성 있음"), "2099-01-01")).toBe(
      "신청 가능"
    );
  });

  // 대상이 아닌 사람에게 '접수 마감'이라고 하면 다음 회차를 기다리면 된다고 읽힌다.
  it("대상이 아니면 접수 기간과 상관없이 '대상 아님'", () => {
    expect(cardStatus(정책({}), 태그("해당 없음"), "2027-01-01")).toBe("대상 아님");
    expect(cardStatus(정책({}), 태그("해당 없음"), "2026-06-01")).toBe("대상 아님");
  });

  it("접수 기간 밖이면 모름이 남아 있어도 지금 신청할 수는 없다", () => {
    expect(cardStatus(정책({}), 태그("확인 필요"), "2027-01-01")).toBe("접수 마감");
  });
});
