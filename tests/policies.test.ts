import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import type { Policy } from "@/lib/types";

const policies = policiesJson as Policy[];
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
      expect(p.benefit_summary, `${p.id}: benefit_summary 없음`).toBeTruthy();
      expect(p.benefit_type, `${p.id}: benefit_type 없음`).toBeTruthy();
      expect(p.effective_year, `${p.id}: effective_year 없음`).toBeTruthy();
      expect(Array.isArray(p.extra_conditions), `${p.id}: extra_conditions 가 배열이 아님`).toBe(true);
    }
  });

  it("모든 정책에 출처와 확인 기록이 있다", () => {
    for (const p of policies) {
      expect(p.source_url?.startsWith("http"), `${p.id}: source_url 이 http 로 시작하지 않음`).toBe(true);
      expect(p.apply_url?.startsWith("http"), `${p.id}: apply_url 이 http 로 시작하지 않음`).toBe(true);
      expect(p.verified_at, `${p.id}: verified_at 없음`).toMatch(DATE);
      expect(p.verified_by, `${p.id}: verified_by 없음 — 누가 확인했는지 적어야 함`).toBeTruthy();
    }
  });

  it("filter 4개 필드가 모두 있다", () => {
    for (const p of policies) {
      expect(typeof p.filter?.age_min, `${p.id}: filter.age_min 없음`).toBe("number");
      expect(typeof p.filter?.age_max, `${p.id}: filter.age_max 없음`).toBe("number");
      expect(p.filter?.age_min <= p.filter?.age_max, `${p.id}: age_min 이 age_max 보다 큼`).toBe(true);
      expect(p.filter?.regions?.length, `${p.id}: filter.regions 가 비어 있음`).toBeGreaterThan(0);
      expect(p.filter?.statuses?.length, `${p.id}: filter.statuses 가 비어 있음`).toBeGreaterThan(0);
      expect(typeof p.filter?.income_bracket_max, `${p.id}: filter.income_bracket_max 없음`).toBe("number");
    }
  });

  it("신청 기간의 날짜 형식이 올바르고 종료일이 시작일 이후다", () => {
    for (const p of policies) {
      expect(p.application_start, `${p.id}: application_start 형식 오류`).toMatch(DATE);
      expect(p.application_end, `${p.id}: application_end 형식 오류`).toMatch(DATE);
      expect(p.application_end >= p.application_start, `${p.id}: 종료일이 시작일보다 앞섬`).toBe(true);
    }
  });

  it("tier 2 정책에는 계산에 필요한 필드가 있다", () => {
    for (const p of policies.filter((p) => p.tier === 2)) {
      expect(p.required_inputs?.length, `${p.id}: required_inputs 없음`).toBeGreaterThan(0);
      expect(p.benefit_formula, `${p.id}: benefit_formula 없음`).toBeTruthy();
      expect(p.payment_schedule, `${p.id}: payment_schedule 없음`).toBeTruthy();
      expect(p.exclusive_group, `${p.id}: exclusive_group 없음`).toBeTruthy();
    }
  });

  it("tier 는 1 또는 2 다", () => {
    for (const p of policies) {
      expect([1, 2].includes(p.tier), `${p.id}: tier 가 ${p.tier} — 1 또는 2 여야 함`).toBe(true);
    }
  });
});
