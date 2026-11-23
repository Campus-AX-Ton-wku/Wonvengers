import { describe, expect, it } from "vitest";
import { GUIDES, findGuide, guidesForHousing } from "../guides";
import { ICON3D_NAMES } from "../icons3d";

const PUBLIC_URL = /^https:\/\/([a-z0-9-]+\.)*(go\.kr|gov\.kr|or\.kr|korea\.kr)(\/|$)/;
// 한국부동산원 청약홈은 .co.kr 이다 — 아파트 청약을 받는 유일한 공식 창구라 이름으로만 허용한다 (11/22)
const isPublicUrl = (url: string) => PUBLIC_URL.test(url) || /^https:\/\/www\.applyhome\.co\.kr(\/|$)/.test(url);

describe("주거 가이드 (lib/guides.ts)", () => {
  it("다섯 편 — 계약 전 · 전세사기 · 보증금 · 서류 · 청약, 홈 카드 순서 그대로", () => {
    expect(GUIDES.map((g) => g.id)).toEqual(["before-contract", "avoid-jeonse-fraud", "protect-deposit", "where-documents", "cheongyak"]);
  });

  it("글마다 출처가 있고, 모두 https 공공 주소(go.kr · gov.kr · or.kr · korea.kr)다", () => {
    for (const g of GUIDES) {
      expect(g.sources.length).toBeGreaterThan(0);
      for (const s of g.sources) expect(isPublicUrl(s.url)).toBe(true);
    }
  });

  it("'어디서' 바로가기도 출처와 같은 규칙 — https 공공 주소만, 이름은 비어 있지 않다 (11/22 ggue)", () => {
    const places = GUIDES.flatMap((g) => g.sections.flatMap((s) => s.where ?? []));
    expect(places.filter((p) => p.url).length).toBeGreaterThanOrEqual(15);
    for (const p of places) {
      expect(p.name.length).toBeGreaterThan(0);
      if (p.url) expect(isPublicUrl(p.url)).toBe(true);
    }
  });

  it("바로가기 예 — 시세는 실거래가 지도 네 종류, 전입신고 · 임대차 신고는 정부24 서비스 화면", () => {
    const where = (id: string, step: number) => findGuide(id)!.sections[step - 1].where ?? [];
    expect(where("before-contract", 1).map((p) => p.name)).toEqual(["아파트", "연립·다세대", "단독·다가구", "오피스텔"]);
    expect(where("before-contract", 1)[3].url).toBe("https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=D&mobileAt=");
    expect(where("protect-deposit", 1)[0].url).toBe("https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000016");
    expect(where("protect-deposit", 3)[0].url).toBe("https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=16130000132");
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

  it("전세 — 보증금 지키기부터, 둘째에 전세사기 (11/23)", () => {
    expect(ids("전세")).toEqual(["protect-deposit", "avoid-jeonse-fraud", "before-contract", "where-documents"]);
    expect(guidesForHousing("전세").tag).toBe("전세라면 먼저");
  });

  it("그 외 · 안 답함 — 지금 순서 그대로, 꼬리표 없음", () => {
    for (const h of ["그 외", null] as const) {
      expect(ids(h)).toEqual(GUIDES.map((g) => g.id));
      expect(guidesForHousing(h).tag).toBeNull();
    }
  });
});

describe("서류 떼는 곳 1장 — 지도 버튼 (11/22)", () => {
  const section = findGuide("where-documents")!.sections[0];

  it("placesMap 은 이 장 1번 섹션에만 있다", () => {
    expect(section.placesMap).toBe(true);
    const marked = GUIDES.flatMap((g) => g.sections.map((s, i) => ({ id: g.id, i, on: s.placesMap })))
      .filter((x) => x.on)
      .map((x) => `${x.id}/${x.i}`);
    expect(marked).toEqual(["where-documents/0"]);
  });

  it("발급기에서도 뗄 수 있다는 줄", () => {
    expect(section.body.join(" ")).toContain("무인민원발급기에서 뗄 수 있는 서류는 지도에서 서류별로 골라 볼 수 있어요");
  });

  it("행안부 출처", () => {
    expect(findGuide("where-documents")!.sources.map((s) => s.name)).toContain("행정안전부 무인민원발급기정보");
  });

  it("앱 안 링크(links)는 '/' 로 시작하는 앱 주소만, 글자는 비어 있지 않다 (11/22 청약 가이드)", () => {
    const links = GUIDES.flatMap((g) => g.sections.flatMap((s) => s.links ?? []));
    for (const l of links) {
      expect(l.href).toMatch(/^\/[a-z]/);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });
});
