// apps/web/lib/__tests__/home.test.ts
import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { resolveAnswers } from "../age";
import { groupPolicies, splitByApplicationWindow } from "../discovery";
import { availableCount, homePose, openPolicies, savedCards, sortSavedCards, type SavedCard } from "../home";
import type { DiscoveryAnswers, PolicyMeta } from "../types";
import { birthDateForAge } from "./fixtures";

const policies = policiesJson as PolicyMeta[];
const none = { eligibility: false, period: false, documents: false };
const read = { checklist: () => none, documents: () => [] as string[] };
const TODAY = "2026-11-17";
const 익산_대학생: DiscoveryAnswers = {
  birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세",
};

describe("홈 계산", () => {
  it("답이 하나도 없으면 null — '시작하기'를 보여 준다", () => {
    expect(availableCount(policies, { birthDate: null, region: null, status: null, incomeBracket: null, housingType: null }, TODAY)).toBeNull();
  });

  it("지금 신청할 수 있는 후보 수 (목록 화면과 같은 계산)", () => {
    const n = availableCount(policies, 익산_대학생, TODAY);
    expect(n).toBeGreaterThan(0);
  });

  it("신청할 수 있는 정책은 목록 화면과 같은 것, 같은 순서다", () => {
    const list = splitByApplicationWindow(groupPolicies(policies, resolveAnswers(익산_대학생, TODAY)), TODAY).신청가능;
    expect(openPolicies(policies, 익산_대학생, TODAY)?.map((p) => p.id)).toEqual(list.map((t) => t.policy.id));
  });

  it("찜한 카드는 찜한 순서, 데이터에 없는 id 는 빼고, 마감 표시와 진행률을 붙인다", () => {
    const cards = savedCards(policies, ["no-such-policy", "youth-housing-benefit-split-payment", "moland-youth-rent-support"], TODAY, read);
    expect(cards.map((c) => c.policy.id)).toEqual(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
    expect(cards[0].deadline).toBe("상시");
    expect(cards[1].deadline).toBe("접수 마감");
    // 주거급여는 서류 목록이 있다(11/17 입력) — 홈 카드는 서류만 센다
    const docs = cards[0].policy.documents ?? [];
    expect(docs.length).toBeGreaterThan(0);
    expect(cards[0].progress).toMatchObject({ label: `서류 0/${docs.length} 준비`, done: 0, total: docs.length });
    expect(cards[1].progress).toMatchObject({ label: "신청 준비 0/3", done: 0, total: 3 });
  });
});

describe("요약 카드 마스코트 포즈 — 위에서부터 먼저 맞는 하나", () => {
  const policy = policies[0];
  const card = (deadline: string, done: number, total = 3): SavedCard => ({
    policy, deadline, progress: { kind: "checks", done, total, label: `신청 준비 ${done}/${total}` },
  });

  it("신청할 수 있는 게 0건이면 empty — 찜 준비가 끝났어도", () => {
    expect(homePose(0, [card("상시", 3)])).toBe("empty");
  });

  it("지금 신청할 수 있는 찜이 모두 준비 끝이면 success", () => {
    expect(homePose(4, [card("상시", 3), card("D-12", 5, 5)])).toBe("success");
  });

  it("마감·예정인 찜은 따지지 않는다 — 지금 신청할 수 없다", () => {
    expect(homePose(4, [card("상시", 3), card("접수 마감", 1), card("신청 예정", 0)])).toBe("success");
    expect(homePose(4, [card("접수 마감", 3)])).toBe("found");
  });

  it("하나라도 덜 됐거나 찜이 없으면 found", () => {
    expect(homePose(4, [card("상시", 3), card("오늘 마감", 2)])).toBe("found");
    expect(homePose(4, [])).toBe("found");
  });
});

describe("관심 탭 정렬 (sortSavedCards)", () => {
  const p = (id: string, applicationStart: string, applicationEnd: string | null) =>
    ({ id, name: id, applicationStart, applicationEnd } as unknown as PolicyMeta);
  const card = (policy: PolicyMeta): SavedCard => ({ policy, deadline: "", progress: { kind: "checklist", label: "", done: 0, total: 3 } } as unknown as SavedCard);
  // 찜한 순서(최근 것이 앞)
  const cards = [
    card(p("closed", "2026-01-01", "2026-10-31")),
    card(p("always", "2026-01-01", null)),
    card(p("d20", "2026-11-01", "2026-12-07")),
    card(p("soon", "2026-12-01", "2026-12-20")),
    card(p("today", "2026-11-01", TODAY)),
    card(p("always2", "2026-01-01", null)),
  ];

  it("최근 찜한 순은 찜한 순서 그대로", () => {
    expect(sortSavedCards(cards, "recent", TODAY).map((c) => c.policy.id)).toEqual(["closed", "always", "d20", "soon", "today", "always2"]);
  });

  it("마감 가까운 순 — 마감일 있는 접수 중 → 상시 → 신청 예정 → 접수 마감, 같은 칸은 찜한 순서", () => {
    expect(sortSavedCards(cards, "deadline", TODAY).map((c) => c.policy.id)).toEqual(["today", "d20", "always", "always2", "soon", "closed"]);
  });

  it("원래 배열은 건드리지 않는다", () => {
    const before = cards.map((c) => c.policy.id);
    sortSavedCards(cards, "deadline", TODAY);
    expect(cards.map((c) => c.policy.id)).toEqual(before);
  });
});
