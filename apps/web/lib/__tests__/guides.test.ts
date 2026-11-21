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

describe("서류 떼는 곳 1장 — 서류 단위 (11/22)", () => {
  const section = findGuide("where-documents")!.sections[0];

  it("서류 7개, 계약서 사본만 온라인 링크가 없다", () => {
    expect(section.documents?.map((d) => d.name)).toEqual([
      "주민등록등본",
      "가족관계증명서",
      "건강보험 자격득실확인서",
      "소득금액증명",
      "임대차계약서 사본",
      "건축물대장",
      "등기부등본",
    ]);
    const noLink = section.documents!.filter((d) => !d.online).map((d) => d.name);
    expect(noLink).toEqual(["임대차계약서 사본"]);
  });

  it("발급기에서도 뗄 수 있다는 줄과 행안부 출처", () => {
    expect(section.body.join(" ")).toContain("무인민원발급기에서 뗄 수 있는 서류는 지도에서 서류별로 골라 볼 수 있어요");
    expect(findGuide("where-documents")!.sources.map((s) => s.name)).toContain("행정안전부 무인민원발급기정보");
  });

  it("온라인 링크는 https 이고 확인해 둔 주소다", () => {
    const urls = Object.fromEntries(section.documents!.filter((d) => d.online).map((d) => [d.name, d.online!.url]));
    expect(urls["주민등록등본"]).toBe("https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010001&CappBizCD=13100000015&tp_seq=01");
    expect(urls["소득금액증명"]).toBe("https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000021");
    for (const url of Object.values(urls)) expect(url).toMatch(/^https:\/\//);
  });

  it("글 목록(where)은 이 장에서 쓰지 않는다 — 서류 칸과 두 번 나오지 않게", () => {
    expect(section.where).toBeUndefined();
  });
});
