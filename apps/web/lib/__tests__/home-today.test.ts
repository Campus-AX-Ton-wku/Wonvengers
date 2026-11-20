import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { todayTodo, todoPolicyId, upcomingSchedule } from "../home-today";
import type { DiscoveryAnswers, PolicyMeta } from "../types";
import { birthDateForAge } from "./fixtures";

const policies = policiesJson as PolicyMeta[];
const none = { eligibility: false, period: false, documents: false };
const read = { checklist: () => none, documents: () => [] as string[] };
const 익산_대학생: DiscoveryAnswers = {
  birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세",
};
const byId = (id: string) => policies.find((p) => p.id === id)!;
const 청년월세 = byId("moland-youth-rent-support");
const 전입 = byId("iksan-move-in-household-incentive");

describe("오늘 할 일 (lib/home-today.ts todayTodo)", () => {
  it("1순위 — 관심 지원금 마감 7일 이하: 남은 날 · 준비 진행", () => {
    const { item, more } = todayTodo(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-25", read, true);
    expect(item).toMatchObject({ kind: "deadline", days: 5, progress: { done: 0, total: 3 } });
    expect(todoPolicyId(item)).toBe("iksan-youth-rent-support");
    expect(more).toBe(0);
  });

  it("마감 7일 이하가 둘이면 가까운 것 하나, 나머지 수는 more", () => {
    const a = { ...청년월세, id: "a", applicationStart: "2026-09-01", applicationEnd: "2026-09-30" };
    const b = { ...청년월세, id: "b", applicationStart: "2026-09-01", applicationEnd: "2026-09-27" };
    const { item, more } = todayTodo([...policies, a, b], 익산_대학생, ["a", "b"], "2026-09-25", read, true);
    expect(todoPolicyId(item)).toBe("b");
    expect(more).toBe(1);
  });

  it("위 순위가 이긴다 — 계산 전이어도 마감 임박부터", () => {
    expect(todayTodo(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-25", read, false).item?.kind).toBe("deadline");
  });

  it("2순위 — 관심 지원금 신청이 오늘 시작 (마감이 멀면)", () => {
    const { item } = todayTodo(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-04-15", read, true);
    expect(item).toMatchObject({ kind: "starts-today" });
    expect(todoPolicyId(item)).toBe("iksan-youth-rent-support");
  });

  it("3순위 — 내 조건으로 새로 열린 지원금 (관심에 안 담아도)", () => {
    const { item } = todayTodo(policies, 익산_대학생, [], "2026-04-05", read, true);
    expect(item).toMatchObject({ kind: "opened", days: 6 });
    expect(todoPolicyId(item)).toBe("moland-youth-rent-support");
  });

  it("3순위 — 앱에 새로 올라온 지원금(30일 안)이 새로 열린 것보다 먼저, 나머지는 more", () => {
    const fresh: PolicyMeta = { ...전입, id: "fresh", publishedAt: "2026-04-03T01:00:00Z" };
    const { item, more } = todayTodo([...policies, fresh], 익산_대학생, [], "2026-04-05", read, true);
    expect(item?.kind).toBe("new");
    expect(todoPolicyId(item)).toBe("fresh");
    expect(more).toBe(1); // 새로 열린 청년월세
  });

  it("4순위 — 급한 일이 없고 계산 전이면 계산하기", () => {
    expect(todayTodo(policies, 익산_대학생, [], "2026-11-20", read, false)).toEqual({ item: { kind: "calc" }, more: 0 });
  });

  it("5순위 — 지금 신청할 수 있는 관심 지원금을 준비하다 멈췄으면 이어서", () => {
    const oneDoc = { checklist: () => none, documents: () => [전입.documents![0].name] };
    const { item, more } = todayTodo(policies, 익산_대학생, [전입.id], "2026-11-20", oneDoc, true);
    expect(item).toMatchObject({ kind: "stalled", progress: { done: 1, total: 5 } });
    expect(more).toBe(0);
  });

  it("준비를 다 했거나 · 아직 시작 안 했거나 · 지금 신청할 수 없으면 5순위가 아니다 → 할 일 없음", () => {
    const all = { checklist: () => none, documents: () => 전입.documents!.map((d) => d.name) };
    expect(todayTodo(policies, 익산_대학생, [전입.id], "2026-11-20", all, true).item).toBeNull();
    expect(todayTodo(policies, 익산_대학생, [전입.id], "2026-11-20", read, true).item).toBeNull();
    const started = { checklist: () => ({ eligibility: true, period: false, documents: false }), documents: () => [] as string[] };
    // 청년월세는 5/29 마감 — 11/20 엔 접수 마감
    expect(todayTodo(policies, 익산_대학생, [청년월세.id], "2026-11-20", started, true).item).toBeNull();
  });
});

describe("다가오는 일정 (lib/home-today.ts upcomingSchedule)", () => {
  const ev = (list: ReturnType<typeof upcomingSchedule>) => list.map((e) => `${e.kind}:${e.policy.id}:${e.days}`);

  it("관심 지원금의 신청 시작일 — 14일 안이면 넣고, 15일이면 뺀다", () => {
    expect(ev(upcomingSchedule(policies, ["iksan-youth-rent-support"], "2026-04-01", null))).toEqual(["start:iksan-youth-rent-support:14"]);
    expect(upcomingSchedule(policies, ["iksan-youth-rent-support"], "2026-03-31", null)).toEqual([]);
  });

  it("마감일 — 오늘 마감(0일)도 넣는다. 지난 시작일은 일정이 아니다", () => {
    expect(ev(upcomingSchedule(policies, ["iksan-youth-rent-support"], "2026-09-30", null))).toEqual(["end:iksan-youth-rent-support:0"]);
  });

  it("상시 접수는 일정이 없다", () => {
    expect(upcomingSchedule(policies, [전입.id, "youth-housing-benefit-split-payment"], "2026-11-20", null)).toEqual([]);
  });

  it("시작 · 마감이 둘 다 14일 안이면 둘 다 — 가까운 순, 같은 날이면 마감 먼저", () => {
    const short = { ...청년월세, id: "short", applicationStart: "2026-04-10", applicationEnd: "2026-04-12" };
    const other = { ...청년월세, id: "other", applicationStart: "2026-03-01", applicationEnd: "2026-04-10" };
    expect(ev(upcomingSchedule([...policies, short, other], ["short", "other"], "2026-04-05", null))).toEqual([
      "end:other:5", "start:short:5", "end:short:7",
    ]);
  });

  it("오늘 할 일 카드에 오른 정책은 뺀다", () => {
    expect(upcomingSchedule(policies, ["iksan-youth-rent-support"], "2026-04-01", "iksan-youth-rent-support")).toEqual([]);
  });
});
