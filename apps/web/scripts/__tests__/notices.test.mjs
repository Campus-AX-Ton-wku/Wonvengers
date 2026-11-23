import { describe, expect, it } from "vitest";
import { collectNotices, formatSnapshot, fromApplyhome, fromMyhome, mergeNotices, myhomeRows, ymd } from "../notices/build.mjs";

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
