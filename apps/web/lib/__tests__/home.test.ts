// apps/web/lib/__tests__/home.test.ts
import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import { availableCount, savedCards } from "../home";
import type { PolicyMeta } from "../types";
import { birthDateForAge } from "./fixtures";

const policies = policiesJson as PolicyMeta[];
const none = { eligibility: false, period: false, documents: false };
const read = { checklist: () => none, documents: () => [] as string[] };

describe("홈 계산", () => {
  it("답이 하나도 없으면 null — '시작하기'를 보여 준다", () => {
    expect(availableCount(policies, { birthDate: null, region: null, status: null, incomeBracket: null, housingType: null }, "2026-11-17")).toBeNull();
  });

  it("지금 신청할 수 있는 후보 수 (목록 화면과 같은 계산)", () => {
    const n = availableCount(policies, {
      birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세",
    }, "2026-11-17");
    expect(n).toBeGreaterThan(0);
  });

  it("찜 카드는 찜한 순서, 데이터에 없는 id 는 빼고, 마감 표시와 진행률을 붙인다", () => {
    const cards = savedCards(policies, ["no-such-policy", "youth-housing-benefit-split-payment", "moland-youth-rent-support"], "2026-11-17", read);
    expect(cards.map((c) => c.policy.id)).toEqual(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
    expect(cards[0].deadline).toBe("상시");
    expect(cards[1].deadline).toBe("접수 마감");
    expect(cards[0].progress).toMatchObject({ label: "신청 준비 0/3", done: 0, total: 3 });
  });
});
