import { describe, expect, it } from "vitest";
import { HOUSE_CHECKLIST_CARD, HOUSE_CHECKLIST_GROUPS, HOUSE_CHECKLIST_ITEM_IDS, HOUSE_CHECKLIST_SOURCES, parseHouseChecklist } from "../house-checklist";
import { findGuide } from "../guides";

const items = HOUSE_CHECKLIST_GROUPS.flatMap((g) => g.items);

describe("집 보러 갈 때 체크리스트 (lib/house-checklist.ts)", () => {
  it("네 무리 22줄 — 집 안 9 · 주변 4 · 돈 · 계약 4 · 서류 5, id 는 겹치지 않는다", () => {
    expect(HOUSE_CHECKLIST_GROUPS.map((g) => [g.title, g.items.length])).toEqual([
      ["집 안", 9],
      ["주변", 4],
      ["돈 · 계약", 4],
      ["서류", 5],
    ]);
    expect(new Set(HOUSE_CHECKLIST_ITEM_IDS).size).toBe(22);
    expect(HOUSE_CHECKLIST_ITEM_IDS).toEqual(items.map((i) => i.id));
  });

  it("새 사실 금지 — 서류 말고는 줄마다 출처 키가 있고, 키는 출처 목록에 있다", () => {
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.how.length).toBeGreaterThan(0);
      if (item.id.startsWith("paper:")) continue;
      expect(item.sources.length).toBeGreaterThan(0);
      for (const key of item.sources) expect(HOUSE_CHECKLIST_SOURCES.map((s) => s.key)).toContain(key);
    }
  });

  it("서류 다섯 줄은 '계약 전에 꼭 볼 것' 장에서 그대로 — 용어 · 한 줄 할 일", () => {
    const sections = findGuide("before-contract")!.sections;
    const paper = HOUSE_CHECKLIST_GROUPS.find((g) => g.id === "paper")!;
    expect(paper.items.map((i) => [i.label, i.how])).toEqual(sections.map((s) => [s.keyword, s.lead]));
    expect(paper.more).toEqual({ href: "/guides/before-contract", label: "자세히는 '계약 전에 꼭 볼 것'" });
  });

  it("출처는 https 공공 주소, 기관 이름 · 주제에 줄표나 띄운 가운뎃점을 쓰지 않는다", () => {
    expect(HOUSE_CHECKLIST_SOURCES).toHaveLength(7);
    for (const s of HOUSE_CHECKLIST_SOURCES) {
      expect(s.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(go\.kr|gov\.kr|or\.kr|korea\.kr)(\/|$)/);
      expect(s.name).not.toMatch(/—| · /);
      if (s.topic) expect(s.topic).not.toMatch(/—| · /);
    }
  });

  it("판정 · 틀린 말 금지 — '계약해도' · '무효'를 쓰지 않는다", () => {
    expect(JSON.stringify(HOUSE_CHECKLIST_GROUPS)).not.toMatch(/계약해도|무효/);
  });

  it("카드는 /guides/checklist 로 간다", () => {
    expect(HOUSE_CHECKLIST_CARD).toMatchObject({ id: "checklist", title: "집 보러 갈 때 체크리스트", icon: "form" });
  });

  it("parseHouseChecklist — 모르는 id · 겹침 · 깨진 값은 버린다", () => {
    expect(parseHouseChecklist(["water", "nope", "water", 3, "night"])).toEqual(["water", "night"]);
    expect(parseHouseChecklist(null)).toEqual([]);
    expect(parseHouseChecklist({ checked: ["water"] })).toEqual([]);
  });
});
