// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { hasUnseen, inboxItems, INBOX_SEEN_KEY, loadInboxSeen, markInboxSeen } from "../inbox";
import type { DiscoveryAnswers, PolicyMeta } from "../types";
import { birthDateForAge } from "./fixtures";

const policies = policiesJson as PolicyMeta[];
const none = { eligibility: false, period: false, documents: false };
const read = { checklist: () => none, documents: () => [] as string[] };
const 익산_대학생: DiscoveryAnswers = {
  birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세",
};
const 익산청년월세 = policies.find((p) => p.id === "iksan-youth-rent-support")!;
const 청년월세 = policies.find((p) => p.id === "moland-youth-rent-support")!;
const keys = (items: ReturnType<typeof inboxItems>) => items.map((i) => `${i.kind}:${i.policy.id}:${i.days}`);

describe("알림함 (lib/inbox.ts)", () => {
  it("찜한 지원금 마감 7일 이하 → '마감이 다가와요', 남은 날은 days", () => {
    const items = inboxItems(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-25", read);
    expect(keys(items)).toContain("deadline:iksan-youth-rent-support:5");
  });

  it("마감까지 8일이면 아직 알리지 않는다", () => {
    const items = inboxItems(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-22", read);
    expect(items.filter((i) => i.kind === "deadline")).toEqual([]);
  });

  it("찜한 지원금 신청 시작 14일 이하 → '곧 신청이 열려요'", () => {
    const items = inboxItems(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-04-05", read);
    expect(keys(items)).toContain("upcoming:iksan-youth-rent-support:10");
    expect(items.filter((i) => i.kind === "deadline")).toEqual([]);
  });

  it("내 조건으로 지금 신청할 수 있고, 시작한 지 14일 이하 → '새로 신청이 열렸어요' (찜 안 해도)", () => {
    // 청년월세(전국)는 3/30에 열렸다 — 4/5 이면 6일째
    const items = inboxItems(policies, 익산_대학생, [], "2026-04-05", read);
    expect(keys(items)).toContain("opened:moland-youth-rent-support:6");
    // 내 조건에 '해당 없음'인 정책은 새로 열려도 알리지 않는다 (익산 청년월세는 대학생 해당 없음)
    expect(inboxItems(policies, 익산_대학생, [], "2026-04-20", read).some((i) => i.policy.id === "iksan-youth-rent-support")).toBe(false);
    // 상시(1월 1일 시작)는 오래전에 열렸으니 새 소식이 아니다
    expect(items.some((i) => i.policy.applicationEnd === null)).toBe(false);
  });

  it("한 정책은 한 번만 — 찜했고 곧 마감이면 '새로 열렸어요'에는 다시 나오지 않는다", () => {
    const 짧은공고: PolicyMeta = { ...청년월세, id: "short-window", applicationStart: "2026-04-15", applicationEnd: "2026-04-20" };
    const items = inboxItems([...policies, 짧은공고], 익산_대학생, ["short-window"], "2026-04-17", read);
    // 대학생에게 '가능'인 정책을 복제했으니 '새로 열렸어요' 후보이기도 하다 — 그래도 한 번만
    expect(items.filter((i) => i.policy.id === "short-window").map((i) => i.kind)).toEqual(["deadline"]);
  });

  it("답이 하나도 없으면 '새로 열렸어요'는 비고, 찜 알림만", () => {
    const empty = { birthDate: null, region: null, status: null, incomeBracket: null, housingType: null };
    expect(inboxItems(policies, empty, [], "2026-04-20", read)).toEqual([]);
  });
});

describe("읽음 표시", () => {
  beforeEach(() => window.localStorage.clear());

  it("본 알림은 다시 '새 소식'이 아니다 — 마감일이 바뀌면 새 알림이다", () => {
    const items = inboxItems(policies, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-25", read);
    expect(hasUnseen(items, loadInboxSeen())).toBe(true);
    markInboxSeen(items);
    expect(hasUnseen(items, loadInboxSeen())).toBe(false);

    const 연장 = [{ ...익산청년월세, applicationEnd: "2026-09-29" }];
    const moved = inboxItems(연장, 익산_대학생, ["iksan-youth-rent-support"], "2026-09-25", read);
    expect(hasUnseen(moved, loadInboxSeen())).toBe(true);
  });

  it("저장된 값이 깨져 있어도 빈 목록으로 읽는다", () => {
    window.localStorage.setItem(INBOX_SEEN_KEY, "{not json");
    expect(loadInboxSeen().size).toBe(0);
  });
});
