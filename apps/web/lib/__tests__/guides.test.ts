import { describe, expect, it } from "vitest";
import { GUIDES, findGuide } from "../guides";
import { ICON3D_NAMES } from "../icons3d";

describe("주거 가이드 (lib/guides.ts)", () => {
  it("세 편 — 계약 전 · 보증금 · 서류, 홈 카드 순서 그대로", () => {
    expect(GUIDES.map((g) => g.id)).toEqual(["before-contract", "protect-deposit", "where-documents"]);
  });

  it("글마다 출처가 있고, 모두 https 공공 주소(go.kr · gov.kr · or.kr · korea.kr)다", () => {
    for (const g of GUIDES) {
      expect(g.sources.length).toBeGreaterThan(0);
      for (const s of g.sources) expect(s.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(go\.kr|gov\.kr|or\.kr|korea\.kr)(\/|$)/);
    }
  });

  it("확인일 · 그림 · 장마다 제목 · 한 줄 할 일 · 본문이 비어 있지 않다", () => {
    for (const g of GUIDES) {
      expect(g.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ICON3D_NAMES).toContain(g.icon);
      for (const s of g.sections) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.lead.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("비유를 써도 정확한 용어는 '용어 풀이'에 남긴다 — 대항력 · 우선변제권 · 임차권등기 · 근저당", () => {
    const terms = GUIDES.flatMap((g) => g.sections.flatMap((s) => (s.terms ?? []).map((t) => t.term)));
    for (const t of ["대항력", "우선변제권", "임차권등기", "근저당"]) expect(terms).toContain(t);
  });

  it("출처 이름 · 주제에 줄표(—)나 띄운 가운뎃점( · )을 쓰지 않는다 — 기관 이름과 주제를 칸으로 나눈다", () => {
    for (const g of GUIDES) {
      for (const s of g.sources) {
        expect(s.name).not.toMatch(/—| · /);
        if (s.topic) expect(s.topic).not.toMatch(/—| · /);
      }
    }
  });

  it("자주 바뀌는 수수료 금액은 쓰지 않는다 (F0-5)", () => {
    const text = JSON.stringify(GUIDES);
    expect(text).not.toMatch(/\d+\s*원(?!\s*이)/);
    expect(findGuide("nope")).toBeUndefined();
  });
});
