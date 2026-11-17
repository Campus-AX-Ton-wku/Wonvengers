import { describe, expect, it } from "vitest";
import { conditionsToConfirm, deadlineLabel, homeProgress, pageProgress } from "../preparation";
import type { PolicyMeta } from "../types";
import policiesJson from "@/data/policies.json";
import { makeProfile } from "./fixtures";

const base = { id: "p", applicationStart: "2026-01-01", applicationEnd: null } as unknown as PolicyMeta;
const withDocs = { ...base, documents: [{ name: "가" }, { name: "나" }, { name: "다" }] } as PolicyMeta;
const none = { eligibility: false, period: false, documents: false };

describe("진행률", () => {
  it("서류 목록이 있으면 홈은 서류만 센다 — 목록에 없는 이름은 세지 않는다", () => {
    expect(homeProgress(withDocs, { ...none, eligibility: true }, ["가", "옛 서류"])).toEqual({
      kind: "documents", done: 1, total: 3, label: "서류 1/3 준비",
    });
  });
  it("서류 목록이 없으면 신청 준비 3단계(자격 · 기간 · 서류)", () => {
    expect(homeProgress(base, { eligibility: true, period: true, documents: false }, [])).toEqual({
      kind: "checks", done: 2, total: 3, label: "신청 준비 2/3",
    });
  });
  it("체크리스트 화면은 서류 있으면 자격 + 기간 + 서류", () => {
    expect(pageProgress(withDocs, { eligibility: true, period: false, documents: true }, ["가", "나"])).toEqual({ done: 3, total: 5 });
    expect(pageProgress(base, { eligibility: true, period: false, documents: true }, [])).toEqual({ done: 2, total: 3 });
  });
});

describe("마감 표시 (서울 날짜)", () => {
  const p = (start: string, end: string | null) => ({ ...base, applicationStart: start, applicationEnd: end }) as PolicyMeta;
  it.each([
    [p("2026-01-01", null), "상시"],
    [p("2026-01-01", "2026-11-29"), "D-12"],
    [p("2026-01-01", "2026-11-17"), "오늘 마감"],
    [p("2026-01-01", "2026-11-16"), "접수 마감"],
    [p("2026-12-01", "2026-12-31"), "신청 예정"],
  ])("%#", (policy, label) => {
    expect(deadlineLabel(policy, "2026-11-17")).toBe(label);
  });
});

describe("신청 준비에서 확인할 자격 조건 (11/17 — 결과 화면에서 따지지 않고 여기로 옮겼다)", () => {
  const all = policiesJson as PolicyMeta[];
  const moveIn = all.find((p) => p.id === "iksan-move-in-household-incentive")!;

  it("계산 전(프로필 없음)이면 그 정책만의 조건을 보여 준다", () => {
    expect(conditionsToConfirm(moveIn, null, "2026-11-17")).toEqual([
      "전입 전 1년 이상 다른 시·군·구에 주민등록",
      "예전에 익산시 전입 지원을 받은 적 없음",
    ]);
  });

  it("이미 답한 조건은 빼고 아직 모르는 것만", () => {
    const profile = makeProfile({ selfDeclared: { livedOutsideIksan1YearBeforeMoveIn: true } });
    expect(conditionsToConfirm(moveIn, profile, "2026-11-17")).toEqual(["예전에 익산시 전입 지원을 받은 적 없음"]);
  });

  it("판정 규칙이 없는 새 정책은 공고 원문의 지원 대상을 확인하라고 한다", () => {
    const fresh = { ...moveIn, id: "brand-new-policy" } as PolicyMeta;
    expect(conditionsToConfirm(fresh, null, "2026-11-17")).toEqual(["공고 원문의 지원 대상 · 제외 대상"]);
  });
});
