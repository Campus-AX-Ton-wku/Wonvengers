import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import bracketsJson from "@/data/income-brackets.json";
import { answerSummary, candidateCount, groupPolicies } from "@/lib/discovery";
import type { DiscoveryAnswers, IncomeBracket, PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];
const brackets = bracketsJson as IncomeBracket[];

const 익산_대학생: DiscoveryAnswers = {
  age: 23,
  region: "전북특별자치도 익산시",
  status: "대학생",
  incomeBracket: 1,
};

// 질문 화면과 목록 화면이 같은 분류를 써야 한다. 두 곳에서 따로 계산하면
// CTA 의 건수와 목록의 건수가 어긋난다.
describe("groupPolicies", () => {
  it("정책을 태그별 세 그룹으로 나누고, 어느 그룹에서도 빠뜨리지 않는다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(g.가능.length + g.확인.length + g.해당없음.length).toBe(policies.length);
  });

  it("익산 23세 대학생·소득 1구간이면 가능 2건 · 확인 필요 1건 · 해당 없음 2건이다", () => {
    const g = groupPolicies(policies, 익산_대학생);
    expect(g.가능.map((t) => t.policy.id)).toEqual([
      "moland-youth-rent-support",
      "iksan-newcomer-moving-cost-support",
    ]);
    expect(g.확인.map((t) => t.policy.id)).toEqual(["youth-housing-benefit-split-payment"]);
    expect(g.해당없음.map((t) => t.policy.id)).toEqual([
      "iksan-youth-rent-support",
      "jeonbuk-youth-settlement-support",
    ]);
  });

  it("아무것도 답하지 않으면 해당 없음이 하나도 없다", () => {
    const g = groupPolicies(policies, { age: null, region: null, status: null, incomeBracket: null });
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
    expect(answerSummary({ age: null, region: null, status: null, incomeBracket: null }, brackets)).toEqual([
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
