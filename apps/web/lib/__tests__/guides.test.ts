import { describe, expect, it } from "vitest";
import { GUIDES, findGuide, guidesForHousing } from "../guides";
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

  it("확인일 · 그림 · 장마다 용어 · 제목 · 한 줄 할 일 · 본문이 비어 있지 않다", () => {
    for (const g of GUIDES) {
      expect(g.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ICON3D_NAMES).toContain(g.icon);
      for (const s of g.sections) {
        expect(s.keyword.length).toBeGreaterThan(0);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.lead.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("용어는 윗줄(keyword)로 빠졌으니 제목은 'A = B' · 줄표 꼴로 쓰지 않는다 (11/21 ggue 시안)", () => {
    for (const g of GUIDES) for (const s of g.sections) expect(s.title).not.toMatch(/ = |—/);
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

describe("집 형태별 홈 가이드 순서 (guidesForHousing, 11/20)", () => {
  const ids = (h: Parameters<typeof guidesForHousing>[0]) => guidesForHousing(h).guides.map((g) => g.id);

  it("월세 · 연세 — 서류 떼는 곳부터, 꼬리표 '○○라면 먼저'", () => {
    expect(ids("월세")).toEqual(["where-documents", "protect-deposit", "before-contract"]);
    expect(guidesForHousing("월세").tag).toBe("월세라면 먼저");
    expect(ids("연세")).toEqual(["where-documents", "protect-deposit", "before-contract"]);
    expect(guidesForHousing("연세").tag).toBe("연세라면 먼저");
  });

  it("전세 — 보증금 지키기부터", () => {
    expect(ids("전세")).toEqual(["protect-deposit", "before-contract", "where-documents"]);
    expect(guidesForHousing("전세").tag).toBe("전세라면 먼저");
  });

  it("그 외 · 안 답함 — 지금 순서 그대로, 꼬리표 없음", () => {
    for (const h of ["그 외", null] as const) {
      expect(ids(h)).toEqual(GUIDES.map((g) => g.id));
      expect(guidesForHousing(h).tag).toBeNull();
    }
  });
});
