import { describe, expect, it } from "vitest";
import { deadlineLabel, homeProgress, pageProgress } from "../preparation";
import type { PolicyMeta } from "../types";

const base = { id: "p", applicationStart: "2026-01-01", applicationEnd: null } as unknown as PolicyMeta;
const withDocs = { ...base, documents: [{ name: "가" }, { name: "나" }, { name: "다" }] } as PolicyMeta;
const none = { eligibility: false, period: false, documents: false };

describe("진행률", () => {
  it("서류 목록이 있으면 홈은 서류만 센다 — 목록에 없는 이름은 세지 않는다", () => {
    expect(homeProgress(withDocs, { ...none, eligibility: true }, ["가", "옛 서류"])).toEqual({
      kind: "documents", done: 1, total: 3, label: "서류 1/3 준비",
    });
  });
  it("서류 목록이 없으면 확인 3개", () => {
    expect(homeProgress(base, { eligibility: true, period: true, documents: false }, [])).toEqual({
      kind: "checks", done: 2, total: 3, label: "확인 2/3",
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
