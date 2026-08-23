import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import { POLICY_RULES } from "@/lib/policy-rules";

const policies = policiesJson as PolicyMeta[];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("policies.json 형식", () => {
  it("정책이 1개 이상 있다", () => {
    expect(policies.length).toBeGreaterThan(0);
  });

  it("id가 중복되지 않는다", () => {
    const ids = policies.map((p) => p.id);
    expect(new Set(ids).size, `중복된 id 있음: ${ids.join(", ")}`).toBe(ids.length);
  });

  it("모든 정책에 표시용 필수 필드가 있다", () => {
    for (const p of policies) {
      expect(p.name, `${p.id}: name 없음`).toBeTruthy();
      expect(p.agency, `${p.id}: agency 없음`).toBeTruthy();
      expect(p.regionScope, `${p.id}: regionScope 없음`).toBeTruthy();
      expect(p.benefitSummary, `${p.id}: benefitSummary 없음`).toBeTruthy();
      expect(p.benefitType, `${p.id}: benefitType 없음`).toBeTruthy();
      expect(p.effectiveYear, `${p.id}: effectiveYear 없음`).toBeTruthy();
    }
  });

  it("모든 정책에 출처 링크가 있다", () => {
    for (const p of policies) {
      expect(p.sourceUrl?.startsWith("http"), `${p.id}: sourceUrl 이 http 로 시작하지 않음`).toBe(true);
      expect(p.applyUrl?.startsWith("http"), `${p.id}: applyUrl 이 http 로 시작하지 않음`).toBe(true);
    }
  });

  // verifiedAt 이 null 이면 팀 교차검수 전이라는 뜻이다. 형식만 기계로 막고,
  // "발표 전에 null 이 없어야 한다"는 QA체크리스트의 사람 확인 항목으로 둔다.
  it("verifiedAt 은 null 이거나 YYYY-MM-DD 형식이다", () => {
    for (const p of policies) {
      if (p.verifiedAt !== null) {
        expect(p.verifiedAt, `${p.id}: verifiedAt 형식 오류`).toMatch(DATE);
      }
    }
  });

  it("신청 기간의 날짜 형식이 올바르고 종료일이 시작일 이후다", () => {
    for (const p of policies) {
      expect(p.applicationStart, `${p.id}: applicationStart 형식 오류`).toMatch(DATE);
      if (p.applicationEnd !== null) {
        expect(p.applicationEnd, `${p.id}: applicationEnd 형식 오류`).toMatch(DATE);
        expect(
          p.applicationEnd >= p.applicationStart,
          `${p.id}: 종료일이 시작일보다 앞섬`
        ).toBe(true);
      }
    }
  });

  it("모든 정책에 판정 규칙이 있다", () => {
    // 규칙이 없으면 evaluatePolicy 가 checks 를 빈 배열로 두고 그대로 '예상적용'을
    // 내보낸다 (eligibility.ts). 아무 조건도 검사하지 않은 정책이 통과해 버린다.
    for (const p of policies) {
      expect(POLICY_RULES[p.id], `${p.id}: POLICY_RULES 에 규칙 없음`).toBeTruthy();
    }
  });

  it("정책이 요구하는 입력 항목이 비어 있지 않다", () => {
    for (const p of policies) {
      expect(p.requiredInputs?.length, `${p.id}: requiredInputs 가 비어 있음`).toBeGreaterThan(0);
      expect(Array.isArray(p.exclusiveGroup), `${p.id}: exclusiveGroup 이 배열이 아님`).toBe(true);
    }
  });
});

describe("policies.json 의 1층 discovery 블록", () => {
  it("나이 범위가 있고 하한이 상한보다 크지 않다", () => {
    for (const p of policies) {
      const d = p.discovery;
      expect(typeof d?.ageMin, `${p.id}: discovery.ageMin 없음`).toBe("number");
      expect(typeof d?.ageMax, `${p.id}: discovery.ageMax 없음`).toBe("number");
      expect(d.ageMin <= d.ageMax, `${p.id}: ageMin 이 ageMax 보다 큼`).toBe(true);
    }
  });

  it("regions 가 비어 있지 않다", () => {
    for (const p of policies) {
      expect(p.discovery?.regions?.length, `${p.id}: discovery.regions 가 비어 있음`).toBeGreaterThan(0);
    }
  });

  // statuses / incomeBracketMax 는 공고 확인 전이면 null 이다. null 을 허용하되
  // 값이 들어왔을 때 형식이 맞는지만 막는다. 추정해 채우는 것은 PRD F0-5 위반이다.
  it("statuses 와 incomeBracketMax 는 null 이거나 올바른 형식이다", () => {
    for (const p of policies) {
      const d = p.discovery;
      if (d.statuses !== null) {
        expect(d.statuses.length, `${p.id}: discovery.statuses 가 빈 배열`).toBeGreaterThan(0);
      }
      if (d.incomeBracketMax !== null) {
        expect(typeof d.incomeBracketMax, `${p.id}: incomeBracketMax 형식 오류`).toBe("number");
      }
    }
  });

  // 하한은 익산형 청년월세처럼 소득 밴드가 있는 사업에만 있다(null = 하한 없음).
  // 하한만 있고 상한이 없으면 밴드가 반쪽이라 판정이 이상해진다.
  it("incomeBracketMin 은 null 이거나 1~5 사이 숫자이고, 상한보다 크지 않다", () => {
    for (const p of policies) {
      const { incomeBracketMin: min, incomeBracketMax: max } = p.discovery;
      if (min === null) continue;
      expect(typeof min, `${p.id}: incomeBracketMin 형식 오류`).toBe("number");
      expect(min >= 1 && min <= 5, `${p.id}: incomeBracketMin 이 구간 범위를 벗어남`).toBe(true);
      expect(max, `${p.id}: 하한만 있고 상한이 없음`).not.toBeNull();
      expect(min <= (max as number), `${p.id}: incomeBracketMin 이 Max 보다 큼`).toBe(true);
    }
  });
});
