import { describe, expect, it } from "vitest";
import { collectNotices, formatSnapshot, fromApplyhome, fromMyhome, mergeNotices, myhomeRows, telLabel, ymd } from "../notices/build.mjs";

const TODAY = "2026-11-22";
const myhomeRow = (over = {}) => ({
  pblancId: "1001", pblancNm: "익산제3일반산단 행복주택 추가모집", sttusNm: "일반공고", suplyInsttNm: "LH",
  houseTyNm: "아파트", suplyTyNm: "행복주택", rcritPblancDe: "20261015", beginDe: "20261015", endDe: "20261230",
  url: "https://apply.lh.or.kr/x", pcUrl: "https://www.myhome.go.kr/pc", mobileUrl: "https://www.myhome.go.kr/m",
  signguNm: "익산시", fullAdres: "전북특별자치도 익산시 왕궁면", beforePblancId: "", ...over,
});
const applyhomeRow = (over = {}) => ({
  HOUSE_MANAGE_NO: "2026000123", PBLANC_NO: "2026000123", HOUSE_NM: "두산위브 트레지움 익산", HOUSE_SECD_NM: "APT",
  HSSPLY_ADRES: "전북특별자치도 익산시 마동", SUBSCRPT_AREA_CODE_NM: "전북", RCRIT_PBLANC_DE: "2026-11-18",
  SPSPLY_RCEPT_BGNDE: "2026-11-30", SPSPLY_RCEPT_ENDDE: "2026-11-30", RCEPT_BGNDE: "2026-12-01", RCEPT_ENDDE: "2026-12-02",
  PBLANC_URL: "https://www.applyhome.co.kr/p", BSNS_MBY_NM: "시행사", ...over,
});

describe("날짜 · 모양", () => {
  it("두 모양의 날짜를 YYYY-MM-DD 로, 그 밖은 null", () => {
    expect(ymd("20261123")).toBe("2026-11-23");
    expect(ymd("2026-11-23")).toBe("2026-11-23");
    expect(ymd("")).toBeNull();
    expect(ymd(undefined)).toBeNull();
    expect(ymd("2026.11.23")).toBeNull();
  });
  it("마이홈 목록 — 여러 건 · 한 건(객체) · NODATA 모두 배열로", () => {
    expect(myhomeRows({ response: { body: { item: [{ a: 1 }, { a: 2 }] } } })).toHaveLength(2);
    expect(myhomeRows({ response: { body: { item: { a: 1 } } } })).toEqual([{ a: 1 }]);
    expect(myhomeRows({ response: { header: { resultCode: "03", resultMsg: "NODATA_ERROR" } } })).toEqual([]);
  });
  it("마이홈이 200 응답 안에 오류 코드를 담아 보내면 던진다 — 0건으로 읽으면 반쪽 목록이 오늘 날짜로 굳는다 (리뷰 I-3)", () => {
    expect(() => myhomeRows({ response: { header: { resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" } } })).toThrow(/30/);
    expect(myhomeRows({ response: { header: { resultCode: "00" }, body: { item: [{ a: 1 }] } } })).toEqual([{ a: 1 }]);
  });
});

describe("변환", () => {
  it("마이홈 임대 — 배지는 공급유형, 원문은 url", () => {
    expect(fromMyhome(myhomeRow(), "공공임대")).toMatchObject({
      id: "myhome:1001", source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", supplier: "LH",
      announcedAt: "2026-10-15", applyStart: "2026-10-15", applyEnd: "2026-12-30", url: "https://apply.lh.or.kr/x",
    });
  });
  it("마이홈 분양 — 공급유형이 없으니 배지는 '공공분양', url 이 없으면 pcUrl", () => {
    const n = fromMyhome(myhomeRow({ suplyTyNm: undefined, url: "" }), "공공분양");
    expect(n).toMatchObject({ typeLabel: "공공분양", url: "https://www.myhome.go.kr/pc" });
  });
  it("공고명 · 원문 주소가 없으면 버린다", () => {
    expect(fromMyhome(myhomeRow({ pblancNm: "" }), "공공임대")).toBeNull();
    expect(fromMyhome(myhomeRow({ url: "", pcUrl: "", mobileUrl: "" }), "공공임대")).toBeNull();
  });
  it("청약홈 — 주소에 '익산'이 있는 것만, 접수는 특별공급 시작 ~ 일반 마감", () => {
    expect(fromApplyhome(applyhomeRow(), "아파트 분양")).toMatchObject({
      id: "applyhome:2026000123-2026000123", kind: "아파트 분양", typeLabel: "아파트 분양",
      announcedAt: "2026-11-18", applyStart: "2026-11-30", applyEnd: "2026-12-02", supplier: "시행사",
    });
    expect(fromApplyhome(applyhomeRow({ HSSPLY_ADRES: "전북특별자치도 전주시" }), "아파트 분양")).toBeNull();
  });
  it("청약홈 무순위 — 접수 칸 이름이 다르다(SUBSCRPT_RCEPT_*)", () => {
    const row = applyhomeRow({ SPSPLY_RCEPT_BGNDE: undefined, RCEPT_BGNDE: undefined, RCEPT_ENDDE: undefined, SPSPLY_RCEPT_ENDDE: undefined,
      SUBSCRPT_RCEPT_BGNDE: "2026-12-05", SUBSCRPT_RCEPT_ENDDE: "2026-12-05" });
    expect(fromApplyhome(row, "무순위 · 잔여")).toMatchObject({ applyStart: "2026-12-05", applyEnd: "2026-12-05" });
  });
});

describe("합치기", () => {
  it("같은 공고 여러 줄은 한 번, 정정공고는 이전 공고를 대신한다, 끝난 공고 · 기간 없는 공고는 뺀다", () => {
    const list = [
      fromMyhome(myhomeRow(), "공공임대"),
      fromMyhome(myhomeRow(), "공공임대"), // 단지별 같은 공고
      fromMyhome(myhomeRow({ pblancId: "2000", pblancNm: "원공고" }), "공공분양"),
      fromMyhome(myhomeRow({ pblancId: "2001", pblancNm: "[정정공고]원공고", sttusNm: "정정공고", beforePblancId: "2000" }), "공공분양"),
      fromMyhome(myhomeRow({ pblancId: "3000", endDe: "20261121" }), "공공임대"), // 어제 마감
      fromMyhome(myhomeRow({ pblancId: "4000", beginDe: "", endDe: "" }), "공공임대"),
      null,
    ];
    expect(mergeNotices(list, TODAY).map((n) => n.id)).toEqual(["myhome:1001", "myhome:2001"]);
    expect(mergeNotices(list, TODAY)[0]).not.toHaveProperty("replaces");
  });
  it("스냅숏 — 2칸 들여쓰기 JSON + 줄바꿈", () => {
    const text = formatSnapshot([], "2026-11-22T06:00:00+09:00");
    expect(JSON.parse(text)).toEqual({ generatedAt: "2026-11-22T06:00:00+09:00", notices: [] });
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("받아 오기 (collectNotices)", () => {
  const myhomeJson = (rows) => ({ response: { body: { item: rows, totalCount: rows.length } } });
  const fakeFetch = (overrides = {}) => async (url) => {
    const u = new URL(url);
    if (overrides.fail && u.href.includes(overrides.fail)) throw new Error("HTTP 503");
    if (u.pathname.endsWith("/rsdtRcritNtcList")) return myhomeJson([myhomeRow()]);
    if (u.pathname.endsWith("/ltRsdtRcritNtcList")) return myhomeJson([]);
    if (u.pathname.endsWith("/getAPTLttotPblancDetail")) return { data: [applyhomeRow(), applyhomeRow({ HOUSE_MANAGE_NO: "9", HSSPLY_ADRES: "전주시" })], totalCount: 2 };
    if (u.pathname.endsWith("/getRemndrLttotPblancDetail")) return { data: [], totalCount: 0 };
    throw new Error(`예상 못 한 주소 ${u.pathname}`);
  };
  it("네 목록을 받아 익산만 합친다 — 마이홈은 익산 코드(52 · 140), 청약홈은 공급지역 전북", async () => {
    const seen = [];
    const fetchJson = async (url) => (seen.push(new URL(url)), fakeFetch()(url));
    const notices = await collectNotices({ fetchJson, key: "k", today: TODAY });
    expect(notices.map((n) => n.id)).toEqual(["myhome:1001", "applyhome:2026000123-2026000123"]);
    const rent = seen.find((u) => u.pathname.endsWith("/rsdtRcritNtcList"));
    expect([rent.searchParams.get("brtcCode"), rent.searchParams.get("signguCode")]).toEqual(["52", "140"]);
    const apt = seen.find((u) => u.pathname.endsWith("/getAPTLttotPblancDetail"));
    expect(apt.searchParams.get("cond[SUBSCRPT_AREA_CODE_NM::EQ]")).toBe("전북");
  });
  it("청약홈 응답에 data 배열이 없으면 던진다 — 조용히 0건이 되지 않게 (리뷰 I-3)", async () => {
    const fetchJson = async (url) => (new URL(url).pathname.endsWith("/getRemndrLttotPblancDetail") ? { currentCount: 0 } : fakeFetch()(url));
    await expect(collectNotices({ fetchJson, key: "k", today: TODAY })).rejects.toThrow();
  });
  it("한 목록이라도 실패하면 던진다 — 반쪽 목록으로 덮어쓰지 않게", async () => {
    await expect(collectNotices({ fetchJson: fakeFetch({ fail: "getAPTLttotPblancDetail" }), key: "k", today: TODAY })).rejects.toThrow();
  });
});

describe("상세 (detail)", () => {
  it("마이홈 임대 — 일정(공고 · 접수 · 발표) · 단지 금액(원, 0 은 뺀다) · 문의 전화", () => {
    const n = fromMyhome(myhomeRow({ hsmpNm: "익산부송1", sumSuplyCo: 350, heatMthdNm: "지역난방", rentGtn: 2520000, mtRntchrg: 50160,
      enty: 126000, prtpay: 0, surlus: 2394000, przwnerPresnatnDe: "20270129", refrnc: "LH 콜센터 : 1600-1004 (평일 : 09:00 ~ 18:00)" }), "공공임대");
    expect(n.detail.schedule).toEqual([
      { label: "모집 공고", start: "2026-10-15", end: null },
      { label: "접수", start: "2026-10-15", end: "2026-12-30" },
      { label: "당첨자 발표", start: "2027-01-29", end: null },
    ]);
    expect(n.detail.complexes).toEqual([{ name: "익산부송1", address: "전북특별자치도 익산시 왕궁면", households: 350, heating: "지역난방",
      amounts: [{ label: "임대보증금", won: 2520000 }, { label: "월 임대료", won: 50160 }] }]);
    expect(n.detail.contact).toEqual({ department: "LH 콜센터 : 1600-1004 (평일 : 09:00 ~ 18:00)", phone: "1600-1004", url: null });
    expect(n.detail.houseTypes).toBeNull();
  });
  it("마이홈 분양 — 계약금 · 중도금 · 잔금, 공급 0호(잔여 매각)는 null", () => {
    const n = fromMyhome(myhomeRow({ hsmpNm: "위너스빌", sumSuplyCo: 0, enty: 7755000, prtpay: 0, surlus: 69795000, rentGtn: 0, mtRntchrg: 0 }), "공공분양");
    expect(n.detail.complexes[0]).toMatchObject({ households: null, amounts: [{ label: "계약금", won: 7755000 }, { label: "잔금", won: 69795000 }] });
  });
  it("마이홈 같은 공고 여러 줄 → 단지를 모은다, 똑같은 줄은 한 번", () => {
    const a = fromMyhome(myhomeRow({ hsmpNm: "익산부송1", fullAdres: "무왕로" }), "공공임대");
    const b = fromMyhome(myhomeRow({ hsmpNm: "익산동산", fullAdres: "동천로" }), "공공임대");
    const merged = mergeNotices([a, b, fromMyhome(myhomeRow({ hsmpNm: "익산동산", fullAdres: "동천로" }), "공공임대")], TODAY);
    expect(merged).toHaveLength(1);
    expect(merged[0].detail.complexes.map((c) => c.name)).toEqual(["익산부송1", "익산동산"]);
  });
  it("청약홈 아파트 — 특별공급 · 1순위 · 2순위(해당 · 기타 같으면 한 줄) · 발표 · 계약, \"null\" 은 뺀다", () => {
    const n = fromApplyhome(applyhomeRow({ SPSPLY_RCEPT_BGNDE: "null", SPSPLY_RCEPT_ENDDE: "null",
      GNRL_RNK1_CRSPAREA_RCPTDE: "2026-12-01", GNRL_RNK1_CRSPAREA_ENDDE: "2026-12-01", GNRL_RNK1_ETC_AREA_RCPTDE: "2026-12-01", GNRL_RNK1_ETC_AREA_ENDDE: "2026-12-01",
      GNRL_RNK2_CRSPAREA_RCPTDE: "2026-12-02", GNRL_RNK2_CRSPAREA_ENDDE: "2026-12-02", GNRL_RNK2_ETC_AREA_RCPTDE: "2026-12-03", GNRL_RNK2_ETC_AREA_ENDDE: "2026-12-03",
      PRZWNER_PRESNATN_DE: "2026-12-08", CNTRCT_CNCLS_BGNDE: "2026-12-21", CNTRCT_CNCLS_ENDDE: "2026-12-23" }), "아파트 분양");
    expect(n.detail.schedule).toEqual([
      { label: "모집 공고", start: "2026-11-18", end: null },
      { label: "1순위", start: "2026-12-01", end: null },
      { label: "2순위 해당지역", start: "2026-12-02", end: null },
      { label: "2순위 기타지역", start: "2026-12-03", end: null },
      { label: "당첨자 발표", start: "2026-12-08", end: null },
      { label: "계약", start: "2026-12-21", end: "2026-12-23" },
    ]);
  });
  it("청약홈 순위별 날짜가 없으면(무순위 등) 접수 한 줄", () => {
    const row = applyhomeRow({ SPSPLY_RCEPT_BGNDE: undefined, SPSPLY_RCEPT_ENDDE: undefined, RCEPT_BGNDE: undefined, RCEPT_ENDDE: undefined,
      SUBSCRPT_RCEPT_BGNDE: "2026-12-05", SUBSCRPT_RCEPT_ENDDE: "2026-12-05" });
    expect(fromApplyhome(row, "무순위 · 잔여").detail.schedule).toEqual([
      { label: "모집 공고", start: "2026-11-18", end: null },
      { label: "접수", start: "2026-12-05", end: null },
    ]);
  });
  it("청약홈 — 개요(공급 규모 · 입주 예정 · 시공) · 견본주택 전화 · 홈페이지", () => {
    const n = fromApplyhome(applyhomeRow({ TOT_SUPLY_HSHLDCO: 251, MVN_PREARNGE_YM: "203002", CNSTRCT_ENTRPS_NM: "두산건설 주식회사",
      MDHS_TELNO: "0638581118", HMPG_ADRES: "https://www.두산위브트레지움익산.com" }), "아파트 분양");
    expect(n.detail.facts).toEqual([
      { label: "공급 규모", value: "251세대" },
      { label: "입주 예정", value: "2030년 2월" },
      { label: "시공", value: "두산건설 주식회사" },
    ]);
    expect(n.detail.contact).toEqual({ department: "견본주택", phone: "063-858-1118", url: "https://www.두산위브트레지움익산.com" });
    expect(n.detail.complexes).toEqual([]);
  });
  it("전화번호 모양 — 모르는 모양은 null(틀린 번호를 걸지 않는다)", () => {
    expect(telLabel("0638581118")).toBe("063-858-1118");
    expect(telLabel("0212345678")).toBe("02-1234-5678");
    expect(telLabel("16700511")).toBe("1670-0511");
    expect(telLabel("063-836-3620")).toBe("063-836-3620");
    expect(telLabel("12")).toBeNull();
    expect(telLabel(undefined)).toBeNull();
  });
});
