import { describe, expect, it } from "vitest";
import { fromGov24, fromYouth } from "../sources.mjs";

describe("fromYouth", () => {
  it("신청기간 문자열을 ISO 날짜로 가른다", () => {
    const got = fromYouth({ plcyNm: "청년월세 지원", aplyYmd: "20260330 ~ 20260529" });

    expect(got.applicationStart).toBe("2026-03-30");
    expect(got.applicationEnd).toBe("2026-05-29");
  });

  it("종료일이 없으면 상시로 본다 — 앱의 applicationEnd null 과 같은 뜻이다", () => {
    const got = fromYouth({ plcyNm: "주거급여", aplyYmd: "20260101" });

    expect(got.applicationStart).toBe("2026-01-01");
    expect(got.applicationEnd).toBe(null);
  });

  it("등록을 마지막으로 손본 날을 ISO 로 준다", () => {
    // 이 값이 앱의 verifiedAt 보다 한참 오래됐으면, 어긋남의 원인은
    // 앱이 아니라 이 등록이 낡은 것일 가능성이 높다.
    const got = fromYouth({ plcyNm: "x", lastMdfcnDt: "2025-01-16 20:21:20" });

    expect(got.updatedAt).toBe("2025-01-16");
  });

  it("나이 제한 없음(Y)이면 나이를 말하지 않는다 — 0~0 으로 두면 대조가 헛돈다", () => {
    const got = fromYouth({ plcyNm: "x", sprtTrgtAgeLmtYn: "Y", sprtTrgtMinAge: "0", sprtTrgtMaxAge: "0" });

    expect(got.ageMin).toBe(null);
    expect(got.ageMax).toBe(null);
  });
});

describe("fromGov24", () => {
  it("서비스명은 말한다", () => {
    const got = fromGov24({ 서비스명: "청년월세 지원", 신청기한: "2026년 상반기" });

    expect(got.name).toBe("청년월세 지원");
  });

  it('신청기한이 "2026년 상반기" 라면 날짜를 말하지 않는다', () => {
    // 이 값을 날짜로 우겨 넣으면 앱의 맞는 날짜(3/30~5/29)를 틀린 값으로 덮어쓴다.
    // 말할 수 없는 것은 말하지 않아야 compareField 가 '대조불가'로 처리한다.
    const got = fromGov24({ 서비스명: "청년월세 지원", 신청기한: "2026년 상반기" });

    expect(got.applicationStart).toBe(null);
    expect(got.applicationEnd).toBe(null);
  });

  it("수정일시 14자리를 ISO 로 준다", () => {
    const got = fromGov24({ 서비스명: "x", 수정일시: "20260810153819" });

    expect(got.updatedAt).toBe("2026-08-10");
  });

  it("지원대상이 자유 서술이면 나이를 말하지 않는다", () => {
    const got = fromGov24({ 서비스명: "x", 지원대상: "ㅇ (대상) 「청년기본법」상 청년(만 19~34세 이하*)으로..." });

    expect(got.ageMin).toBe(null);
    expect(got.ageMax).toBe(null);
  });
});
