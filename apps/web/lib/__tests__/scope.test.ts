import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { calculationScope, questionScope } from "../scope";
import { getRequiredQuestions } from "../questions";
import { policiesForRegion } from "../region";
import type { DiscoveryAnswers, PolicyMeta } from "../types";
import { EMPTY_ANSWERS } from "../storage";

/**
 * 2층 범위 (11/23 ggue) — 첫 질문으로 줄인 정책에 맞춰서만 묻는다. 접수가 끝난 정책의 질문은 묻지 않는다.
 * ('원가구(부모님 등) 소득도 함께 심사받나요?'는 국토부 청년월세 하나만 쓰는데, 2026년 접수는 5/29 에 끝났다)
 */
const policies = policiesJson as PolicyMeta[];
const 익산 = "전북특별자치도 익산시";
const 월세 = { region: 익산, contractType: "월세" as const };
const 대학생: DiscoveryAnswers = { birthDate: "2003-08-12", region: 익산, status: "대학생", incomeBracket: 1, housingType: "월세" };
const ids = (ps: PolicyMeta[]) => ps.map((p) => p.id);
const keys = (ps: PolicyMeta[]) => getRequiredQuestions(ps).map((q) => q.key);

describe("questionScope — 판정 질문을 묻는 정책", () => {
  it("접수가 끝난 국토부 청년월세의 '원가구 소득도 함께 심사받나요?'는 11/23 에 묻지 않는다", () => {
    const scope = questionScope(policies, 월세, 대학생, "2026-11-23");
    expect(ids(scope)).not.toContain("moland-youth-rent-support");
    expect(keys(scope)).not.toContain("useOriginHousehold");
  });

  it("접수 중이던 5/1 에는 묻는다", () => {
    const scope = questionScope(policies, 월세, 대학생, "2026-05-01");
    expect(ids(scope)).toContain("moland-youth-rent-support");
    expect(keys(scope)).toContain("useOriginHousehold");
  });

  it("지역 정책 전부에서 모으던 예전보다 질문이 적다 — 결과를 바꾸지 않는 질문이 빠진다", () => {
    const before = keys(policiesForRegion(policies, 익산));
    const after = keys(questionScope(policies, 월세, 대학생, "2026-11-23"));
    expect(after.length).toBeLessThan(before.length);
    for (const k of after) expect(before).toContain(k);
  });
});

describe("calculationScope — 계산(판정)에 넣는 정책", () => {
  it("첫 질문에서 '해당 없음'이면 뺀다 — 대학생에게 재직자 전용(전북 지역정착)은 없다", () => {
    expect(ids(calculationScope(policies, 월세, 대학생, "2026-05-01"))).not.toContain("jeonbuk-youth-settlement-support");
    expect(ids(calculationScope(policies, 월세, { ...대학생, status: "재직" }, "2026-04-01"))).toContain("jeonbuk-youth-settlement-support");
  });

  it("접수가 끝난 정책은 남긴다 — 질문 없이도 '신청 불가'로 판정되고, 전부 마감이면 결과가 '기간 지남' 화면이 된다", () => {
    expect(ids(calculationScope(policies, 월세, 대학생, "2026-11-23"))).toContain("moland-youth-rent-support");
  });

  it("주거 형태는 계약 조건의 계약 형태로 본다 — '그 외'로 답했어도 월세 방을 계산하면 월세 지원이 남는다", () => {
    const 그외 = { ...대학생, housingType: "그 외" as const };
    expect(ids(calculationScope(policies, 월세, 그외, "2026-05-01"))).toContain("moland-youth-rent-support");
    expect(ids(calculationScope(policies, { region: 익산, contractType: "전세" }, 대학생, "2026-05-01"))).not.toContain(
      "moland-youth-rent-support"
    );
  });

  it("첫 질문을 건너뛰었으면(답 없음) 지역 정책을 그대로 둔다", () => {
    expect(ids(calculationScope(policies, 월세, EMPTY_ANSWERS, "2026-11-23")).sort()).toEqual(
      ids(policiesForRegion(policies, 익산)).filter((id) => {
        const p = policies.find((x) => x.id === id)!;
        return p.discovery.housingTypes === null || p.discovery.housingTypes.includes("월세");
      }).sort()
    );
  });
});
