import { describe, expect, it } from "vitest";
import policiesData from "../../data/policies.json";
import type { PolicyMeta, RequiredInputKey } from "../types";
import { QUESTION_REGISTRY, getRequiredQuestions } from "../questions";
import { QUESTION_GROUPS, buildQuestionSteps } from "../steps";
import { REGION_OPTIONS, policiesForRegion } from "../region";

const policies = policiesData as PolicyMeta[];

describe("질문 그룹", () => {
  it("모든 질문이 정확히 한 그룹에 들어간다", () => {
    const grouped = QUESTION_GROUPS.flatMap((g) => g.keys);
    expect(new Set(grouped).size).toBe(grouped.length); // 중복 없음
    expect([...grouped].sort()).toEqual(
      (Object.keys(QUESTION_REGISTRY) as RequiredInputKey[]).sort()
    );
  });

  it("어느 지역이든 실제 물어볼 질문이 하나도 빠지지 않는다", () => {
    for (const { value } of REGION_OPTIONS) {
      const questions = getRequiredQuestions(policiesForRegion(policies, value));
      const stepped = buildQuestionSteps(questions).flatMap((s) => s.questions);
      expect([...stepped.map((q) => q.key)].sort()).toEqual(
        [...questions.map((q) => q.key)].sort()
      );
    }
  });
});

describe("지역 필터", () => {
  it("전국 정책은 모든 지역에 남는다", () => {
    for (const { value } of REGION_OPTIONS) {
      const ids = policiesForRegion(policies, value).map((p) => p.id);
      for (const p of policies.filter((x) => x.regionScope === "전국")) {
        expect(ids).toContain(p.id);
      }
    }
  });

  it("익산 사용자는 전북 광역 정책도 받고, 전주 사용자는 익산 정책을 못 받는다", () => {
    const iksan = policiesForRegion(policies, "전북특별자치도 익산시").map((p) => p.id);
    const jeonju = policiesForRegion(policies, "전북특별자치도 전주시").map((p) => p.id);
    expect(iksan).toContain("jeonbuk-youth-settlement-support");
    expect(iksan).toContain("iksan-youth-rent-support");
    expect(jeonju).toContain("jeonbuk-youth-settlement-support");
    expect(jeonju).not.toContain("iksan-youth-rent-support");
  });

  it("전북 밖 지역은 전국 정책만 남는다", () => {
    const rest = policiesForRegion(policies, "서울특별시 종로구");
    expect(rest.every((p) => p.regionScope === "전국")).toBe(true);
  });
});
