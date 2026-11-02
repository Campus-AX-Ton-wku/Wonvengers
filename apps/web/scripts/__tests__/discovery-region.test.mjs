import { describe, expect, it } from "vitest";
import { PROVINCE_NAMES, classifyAgency } from "../discovery-region.mjs";

/**
 * zipCd 기반 판별(200개 이상 = 전국)이 신뢰할 수 없다는 게 실측으로 드러난 뒤
 * 등록기관명 기반으로 바꿨다. 이 테스트는 그때 실제로 오분류됐던 사례들을
 * 그대로 고정한다 — 다시 zipCd 로 되돌아가면 여기서 잡힌다.
 */
describe("classifyAgency — 실제 오분류 사례 회귀", () => {
  it("강원형 공공주택 공급(강원특별자치도) — zipCd 251개(전국급)였지만 광역이다", () => {
    expect(classifyAgency("강원특별자치도")).toEqual({
      scope: "province",
      province: "강원특별자치도",
      city: null,
    });
  });

  it("의성군 사업 7건 — zipCd 로는 전국에 섞였지만 시군구(의성군)다", () => {
    const 의성군_등록기관들 = [
      "경상북도 의성군 관광복지국", // 청년인큐베이팅공유공간 운영 등 6건
    ];
    for (const name of 의성군_등록기관들) {
      expect(classifyAgency(name)).toEqual({ scope: "city", province: "경상북도", city: "의성군" });
    }
  });

  it("세종시 사업 — 세종특별자치시 기획조정실은 광역이다(세종은 하위 시군구가 없다)", () => {
    expect(classifyAgency("세종특별자치시 기획조정실")).toEqual({
      scope: "province",
      province: "세종특별자치시",
      city: null,
    });
  });

  it("충남 사업 — 충청남도(그 자체)는 광역이다", () => {
    expect(classifyAgency("충청남도")).toEqual({
      scope: "province",
      province: "충청남도",
      city: null,
    });
  });
});

describe("classifyAgency — 기본 판정", () => {
  it("광역명 어디에도 안 걸리면 전국(중앙부처·산하기관)이다", () => {
    expect(classifyAgency("국토교통부")).toEqual({ scope: "national", province: null, city: null });
    expect(classifyAgency("고용노동부")).toEqual({ scope: "national", province: null, city: null });
    expect(classifyAgency("한국고용정보원")).toEqual({ scope: "national", province: null, city: null });
  });

  it("소속을 알 수 없는 이름도 추정하지 않고 전국(기본값)으로 떨어진다", () => {
    expect(classifyAgency("청년정책관")).toEqual({ scope: "national", province: null, city: null });
  });

  it("시·군·구로 끝나는 두 번째 단어가 있으면 시군구다", () => {
    expect(classifyAgency("경기도 군포시")).toEqual({ scope: "city", province: "경기도", city: "군포시" });
    expect(classifyAgency("전북특별자치도 익산시 청년경제국")).toEqual({
      scope: "city",
      province: "전북특별자치도",
      city: "익산시",
    });
  });

  it("부서명(국·과·실·단·청·원·관 등)은 시군구로 오판하지 않는다", () => {
    expect(classifyAgency("경기도 미래평생교육국 청년기회과")).toEqual({
      scope: "province",
      province: "경기도",
      city: null,
    });
    expect(classifyAgency("인천광역시 청년정책담당관")).toEqual({
      scope: "province",
      province: "인천광역시",
      city: null,
    });
    expect(classifyAgency("경상북도 청도군 부군수")).toEqual({
      scope: "city",
      province: "경상북도",
      city: "청도군",
    });
  });

  it("표기 흔들림 — '광주시청'은 '광주광역시'로 정규화된다", () => {
    expect(classifyAgency("광주시청")).toEqual({ scope: "province", province: "광주광역시", city: null });
  });

  it("정식 17개 목록에 없지만 실제 등록기관명으로 존재하는 '전남광주통합특별시'도 광역으로 잡는다", () => {
    expect(classifyAgency("전남광주통합특별시")).toEqual({
      scope: "province",
      province: "전남광주통합특별시",
      city: null,
    });
    expect(classifyAgency("전남광주통합특별시 강진군 인구정책과")).toEqual({
      scope: "city",
      province: "전남광주통합특별시",
      city: "강진군",
    });
  });

  it("이름이 비어 있으면 전국(기본값)으로 떨어진다", () => {
    expect(classifyAgency("")).toEqual({ scope: "national", province: null, city: null });
    expect(classifyAgency(null)).toEqual({ scope: "national", province: null, city: null });
    expect(classifyAgency(undefined)).toEqual({ scope: "national", province: null, city: null });
  });
});

describe("PROVINCE_NAMES", () => {
  it("17개 정식 광역명 + 실측으로 확인된 예외 1개(전남광주통합특별시)를 포함한다", () => {
    expect(PROVINCE_NAMES.length).toBe(18);
    expect(new Set(PROVINCE_NAMES).size).toBe(PROVINCE_NAMES.length); // 중복 없음
  });
});
