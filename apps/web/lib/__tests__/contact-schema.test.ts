import { describe, expect, it } from "vitest";
import policies from "@/data/policies.json";
import loanProducts from "@/data/loan-products.json";
import housingSupply from "@/data/housing-supply.json";
import consultCenters from "@/data/consult-centers.json";

const PHONE = /^(0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const items = [
  ...policies.map((x) => ({ file: "policies", ...x })),
  ...loanProducts.map((x) => ({ file: "loan-products", ...x })),
  ...housingSupply.map((x) => ({ file: "housing-supply", ...x })),
] as { file: string; id: string; contact?: unknown; nextRound?: unknown }[];

describe("연락처·다음 회차 필드", () => {
  it("모든 항목이 contact·nextRound 키를 가진다 (null 허용)", () => {
    for (const item of items) {
      expect("contact" in item, `${item.file}/${item.id} 에 contact 키가 없다`).toBe(true);
      expect("nextRound" in item, `${item.file}/${item.id} 에 nextRound 키가 없다`).toBe(true);
    }
  });

  it("contact 가 있으면 부서는 비어 있지 않고 전화·확인일 형식이 맞다", () => {
    for (const item of items) {
      const c = item.contact as { department: string; phone: string | null; url: string | null; phoneCheckedAt: string | null } | null;
      if (!c) continue;
      expect(c.department.trim(), `${item.id} department`).not.toBe("");
      if (c.phone !== null) expect(c.phone, `${item.id} phone`).toMatch(PHONE);
      if (c.url !== null) expect(c.url, `${item.id} url`).toMatch(/^https:\/\//);
      if (c.phoneCheckedAt !== null) expect(c.phoneCheckedAt, `${item.id} phoneCheckedAt`).toMatch(DATE);
      // 번호 없이 '전화로 확인했다'는 말이 될 수 없다
      if (c.phoneCheckedAt !== null) expect(c.phone, `${item.id} 번호 없이 phoneCheckedAt`).not.toBeNull();
    }
  });

  it("nextRound 가 있으면 문구·확인일·출처가 맞다", () => {
    for (const item of items) {
      const n = item.nextRound as { text: string; confirmedAt: string; via: string } | null;
      if (!n) continue;
      expect(n.text.trim()).not.toBe("");
      expect(n.confirmedAt).toMatch(DATE);
      expect(["공고", "전화"]).toContain(n.via);
    }
  });
});

describe("consult-centers.json", () => {
  it("id 가 중복되지 않고 형식이 맞다", () => {
    const ids = (consultCenters as { id: string }[]).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of consultCenters as { id: string; name: string; regionScope: string; phone: string | null; topics: string[]; verifiedAt: string | null }[]) {
      expect(c.name.trim()).not.toBe("");
      expect(c.regionScope.trim()).not.toBe("");
      if (c.phone !== null) expect(c.phone).toMatch(PHONE);
      expect(Array.isArray(c.topics)).toBe(true);
      if (c.verifiedAt !== null) expect(c.verifiedAt).toMatch(DATE);
    }
  });
});
