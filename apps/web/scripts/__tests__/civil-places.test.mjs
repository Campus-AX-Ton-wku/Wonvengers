import { describe, expect, it } from "vitest";
import { KIOSK_DOCS as APP_DOCS } from "../../lib/places";
import { IKSAN_EMD, KIOSK_DOCS, decideWrite, formatSnapshot, geocodeQuery, pickOffice, toKiosks, toOffice, usableTotal } from "../civil-places/build.mjs";

/** 설치정보 한 행 (2026-11-22 실제 응답에서 값만 줄인 것) */
const install = (over = {}) => ({
  MNG_NO: "405",
  ISSUMCHN_NM: "익산시청",
  INSTL_PLC_ADDR: "전북특별자치도 익산시 인북로32길 1(남중동)",
  INSTL_PLC_DTL_PSTN: "익산시청 광장(종합민원과 입구 옆)",
  WKDY_OPER_BGNG_TM: "00:00",
  WKDY_OPER_END_TM: "2400",
  LHLDY_OPER_BGNG_TM: "00:00",
  LHLDY_OPER_END_TM: "2400",
  OPER_HR_REF_CN: "23:59부터 01:00는 발급기 점검이 많은 시간입니다.",
  USE_YN_NM: "사용",
  OPN_ATMY_GRP_CD: "4681000",
  ...over,
});
const cert = (no, name) => ({ ISSUMCHN_NO: no, CVLCPT_OFCWORK_CLSF_NM: name, OPN_ATMY_GRP_CD: "4681000" });
const kakao = (over = {}) => ({
  place_name: "어양동행정복지센터",
  address_name: "전북특별자치도 익산시 어양동 588",
  road_address_name: "전북특별자치도 익산시 동서로63길 43",
  phone: "063-859-4808",
  category_group_code: "PO3",
  x: "126.97",
  y: "35.96",
  ...over,
});

describe("서류 이름표가 앱(lib/places.ts)과 같다", () => {
  it("key · api 가 같은 순서로", () => {
    expect(KIOSK_DOCS).toEqual(APP_DOCS.map(({ key, api }) => ({ key, api })));
  });
});

describe("주민센터 — 카카오 검색 결과 고르기", () => {
  it("익산 읍면동 29곳", () => {
    expect(IKSAN_EMD).toHaveLength(29);
    expect(new Set(IKSAN_EMD).size).toBe(29);
  });
  it("이름이 그 읍면동으로 시작하고 익산 · 공공기관인 첫 결과", () => {
    const docs = [kakao({ place_name: "어양동행정복지센터 주차장", category_group_code: "PK6" }), kakao()];
    expect(pickOffice("어양동", docs)?.place_name).toBe("어양동행정복지센터");
  });
  it("다른 동 · 다른 시는 고르지 않는다 — 신동을 찾는데 동산동이 나와도", () => {
    expect(pickOffice("신동", [kakao({ place_name: "동산동행정복지센터" })])).toBeNull();
    expect(pickOffice("어양동", [kakao({ address_name: "전북특별자치도 전주시 어양동" })])).toBeNull();
  });
  it("PO3 하위 장소(별관)는 건너뛰고 그 뒤의 진짜 주민센터를 고른다", () => {
    const docs = [kakao({ place_name: "어양동행정복지센터 별관" }), kakao()];
    expect(pickOffice("어양동", docs)?.place_name).toBe("어양동행정복지센터");
  });
  it("영등1동 과 영등2동 은 서로 섞이지 않는다", () => {
    expect(pickOffice("영등1동", [kakao({ place_name: "영등2동행정복지센터" })])).toBeNull();
    expect(pickOffice("영등1동", [kakao({ place_name: "영등1동행정복지센터" })])?.place_name).toBe("영등1동행정복지센터");
  });
  it("'익산시 ' 접두가 붙은 이름도 받는다", () => {
    expect(pickOffice("어양동", [kakao({ place_name: "익산시 어양동행정복지센터" })])).not.toBeNull();
  });
  it("'주민센터' 표기도 받는다", () => {
    expect(pickOffice("마동", [kakao({ place_name: "마동주민센터" })])).not.toBeNull();
  });
  it("장소로 바꿀 때 도로명 주소 · 전화 · 좌표", () => {
    expect(toOffice("어양동", kakao())).toEqual({
      id: "office-어양동",
      kind: "office",
      name: "어양동행정복지센터",
      address: "전북특별자치도 익산시 동서로63길 43",
      detail: null,
      phone: "063-859-4808",
      lat: 35.96,
      lng: 126.97,
      weekday: null,
      holiday: null,
      hoursNote: null,
      documents: [],
    });
  });
});

describe("무인민원발급기 — 설치정보 + 발급제증명", () => {
  it("주소 검색어는 쉼표 · 괄호 · 지번 앞까지", () => {
    expect(geocodeQuery("전북특별자치도 익산시 고봉로 285, 국민건강보험공단 (영등동)")).toBe("전북특별자치도 익산시 고봉로 285");
    expect(geocodeQuery("전북특별자치도 익산시 인북로 353(신동)[전북특별자치도 익산시 신동 806번지 1]")).toBe("전북특별자치도 익산시 인북로 353");
  });

  it("익산 · 사용 중 · 좌표 있는 것만, 서류는 우리 서류 6개 중에서", () => {
    const rows = [
      install(),
      install({ MNG_NO: "999", OPN_ATMY_GRP_CD: "5785000" }), // 다른 시
      install({ MNG_NO: "998", USE_YN_NM: "미사용" }),
      install({ MNG_NO: "997" }), // 좌표 못 찾음
    ];
    const certs = [cert("405", "주민등록표(등본)"), cert("405", "가족관계증명서"), cert("405", "보훈급여금 등 지급 확인원")];
    const coords = new Map([
      ["405", { lat: 35.9483, lng: 126.9577 }],
      ["998", { lat: 1, lng: 1 }],
    ]);
    const { places, skipped } = toKiosks(rows, certs, coords);
    expect(places).toEqual([
      {
        id: "kiosk-405",
        kind: "kiosk",
        name: "익산시청",
        address: "전북특별자치도 익산시 인북로32길 1",
        detail: "익산시청 광장(종합민원과 입구 옆)",
        phone: null,
        lat: 35.9483,
        lng: 126.9577,
        weekday: "24시간",
        holiday: "24시간",
        hoursNote: "23:59부터 01:00는 발급기 점검이 많은 시간입니다.",
        documents: ["resident", "family"],
      },
    ]);
    expect(skipped).toEqual(["997 익산시청 — 좌표를 못 찾음"]);
  });

  it("다른 지자체 코드의 발급제증명 행은 무시 · 코드가 없는 행도 건너뛴다", () => {
    const certs = [
      cert("405", "주민등록표(등본)"),
      { ...cert("405", "가족관계증명서"), OPN_ATMY_GRP_CD: "4500000" },
      { ISSUMCHN_NO: "405", CVLCPT_OFCWORK_CLSF_NM: "건축물대장" },
    ];
    const { places } = toKiosks([install()], certs, new Map([["405", { lat: 1, lng: 2 }]]));
    expect(places[0].documents).toEqual(["resident"]);
  });

  it("공휴일 칸이 비면 null", () => {
    const { places } = toKiosks([install({ LHLDY_OPER_BGNG_TM: "", LHLDY_OPER_END_TM: "" })], [], new Map([["405", { lat: 1, lng: 2 }]]));
    expect(places[0].holiday).toBeNull();
  });
});

describe("formatSnapshot", () => {
  it("2칸 들여쓰기 + 끝 줄바꿈", () => {
    expect(formatSnapshot({ generatedAt: "x", places: [] })).toBe('{\n  "generatedAt": "x",\n  "places": []\n}\n');
  });
});

describe("decideWrite", () => {
  it("29+26 vs 커밋 55 → 쓴다", () => {
    expect(decideWrite({ offices: 29, kiosks: 26, committedCount: 55 }).write).toBe(true);
  });
  it("주민센터 0 → 안 쓴다", () => {
    expect(decideWrite({ offices: 0, kiosks: 26, committedCount: 55 }).write).toBe(false);
  });
  it("발급기 0 → 안 쓴다", () => {
    expect(decideWrite({ offices: 29, kiosks: 0, committedCount: 55 }).write).toBe(false);
  });
  it("40 vs 커밋 55 (44 미만) → 안 쓴다", () => {
    const r = decideWrite({ offices: 20, kiosks: 20, committedCount: 55 });
    expect(r.write).toBe(false);
    expect(r.reason).toContain("80%");
  });
  it("44 vs 커밋 55 → 쓴다", () => {
    expect(decideWrite({ offices: 24, kiosks: 20, committedCount: 55 }).write).toBe(true);
  });
  it("커밋이 빈 스냅숏이면 29+26 → 쓴다", () => {
    expect(decideWrite({ offices: 29, kiosks: 26, committedCount: 0 }).write).toBe(true);
  });
});

describe("usableTotal", () => {
  it("null · 빈 문자 · 문자 · 0 은 모름, 양수만 그 수", () => {
    expect(usableTotal(null)).toBeNull();
    expect(usableTotal(undefined)).toBeNull();
    expect(usableTotal("")).toBeNull();
    expect(usableTotal("abc")).toBeNull();
    expect(usableTotal("0")).toBeNull();
    expect(usableTotal("2506")).toBe(2506);
    expect(usableTotal(2506)).toBe(2506);
  });
});
