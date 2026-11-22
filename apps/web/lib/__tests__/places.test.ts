import { describe, expect, it } from "vitest";
import {
  KIOSK_DOCS,
  directionsUrl,
  distanceKm,
  filterPlaces,
  formatDistance,
  isCityCenter,
  isNearAny,
  matchesQuery,
  MIN_MAP_LEVEL,
  NEAR_KM,
  normalizeQuery,
  type CivilPlace,
} from "@/lib/places";

const place = (over: Partial<CivilPlace> = {}): CivilPlace => ({
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
  hoursNote: null,
  documents: ["resident", "family"],
  ...over,
});

describe("filterPlaces", () => {
  const office = place({ id: "office-어양동", kind: "office", name: "어양동행정복지센터", documents: [] });
  const k1 = place({ id: "kiosk-1", documents: ["resident", "family"] });
  const k2 = place({ id: "kiosk-2", documents: ["resident"] });
  const all = [office, k1, k2];

  it("전체 · 종류별", () => {
    expect(filterPlaces(all, { kind: "all", doc: null })).toHaveLength(3);
    expect(filterPlaces(all, { kind: "office", doc: null }).map((p) => p.id)).toEqual(["office-어양동"]);
    expect(filterPlaces(all, { kind: "kiosk", doc: null }).map((p) => p.id)).toEqual(["kiosk-1", "kiosk-2"]);
  });

  it("서류를 고르면 그 서류를 떼는 발급기만 — 주민센터는 서류 데이터가 없어 뺀다", () => {
    expect(filterPlaces(all, { kind: "kiosk", doc: "family" }).map((p) => p.id)).toEqual(["kiosk-1"]);
    expect(filterPlaces(all, { kind: "all", doc: "family" }).map((p) => p.id)).toEqual(["kiosk-1"]);
  });
});

describe("거리 · 길찾기", () => {
  it("익산시청 ↔ 익산역 약 1.5km 안팎", () => {
    const km = distanceKm({ lat: 35.9483, lng: 126.9577 }, { lat: 35.9405, lng: 126.9466 });
    expect(km).toBeGreaterThan(1);
    expect(km).toBeLessThan(2);
  });
  it("1km 아래는 m, 위는 소수 한 자리 km", () => {
    expect(formatDistance(0.42)).toBe("420m");
    expect(formatDistance(1.234)).toBe("1.2km");
  });
  it("카카오맵 길찾기 주소 — 이름은 인코딩", () => {
    expect(directionsUrl(place())).toBe(`https://map.kakao.com/link/to/${encodeURIComponent("익산시청")},35.9483,126.9577`);
  });
});

describe("서류 이름표", () => {
  it("API 서류 이름 → 화면 이름 6개", () => {
    expect(KIOSK_DOCS.map((d) => d.label)).toEqual([
      "주민등록등본",
      "가족관계증명서",
      "건강보험 자격득실확인서",
      "소득금액증명",
      "건축물대장",
      "등기부등본",
    ]);
  });
});

describe("isNearAny — 내 위치가 장소 가까이인지", () => {
  const all = [place()];
  it("익산역 근처는 true", () => expect(isNearAny({ lat: 35.9405, lng: 126.9466 }, all, NEAR_KM)).toBe(true));
  it("서울은 false", () => expect(isNearAny({ lat: 37.5665, lng: 126.978 }, all, NEAR_KM)).toBe(false));
  it("장소가 없으면 false", () => expect(isNearAny({ lat: 35.9405, lng: 126.9466 }, [], NEAR_KM)).toBe(false));
});

describe("isCityCenter — 읍 · 면이 아니면 시내", () => {
  const at = (address: string) => place({ address });
  it("읍 · 면 주소는 시내가 아니다", () => {
    expect(isCityCenter(at("전북특별자치도 익산시 함열읍 함열중앙로 83"))).toBe(false);
    expect(isCityCenter(at("전북특별자치도 익산시 용안면 용안교동1길 21"))).toBe(false);
  });
  it("동 지역은 시내", () => {
    expect(isCityCenter(at("전북특별자치도 익산시 인북로32길 1"))).toBe(true);
    expect(isCityCenter(at("전북특별자치도 익산시 동서로63길 43"))).toBe(true);
  });
});

describe("검색 — normalizeQuery · matchesQuery", () => {
  const office = place({ id: "office-어양동", kind: "office", name: "어양동행정복지센터", detail: null, documents: [] });
  const kioskEoyang = place({ id: "k1", name: "어양동 행정복지센터", detail: "1층 로비" });
  const kioskCity = place({ id: "k2", name: "익산시청", address: "전북특별자치도 익산시 인북로32길 1" });
  const all = [office, kioskEoyang, kioskCity];
  const names = (q: string) => all.filter((p) => matchesQuery(p, q)).map((p) => p.id);

  it("공백 · 대소문자를 없애 비교한다", () => {
    expect(normalizeQuery("  어양동  행정 복지센터 ")).toBe("어양동행정복지센터");
    expect(normalizeQuery("ABC d")).toBe("abcd");
  });
  it("빈 검색어는 모두", () => {
    expect(names("")).toEqual(["office-어양동", "k1", "k2"]);
    expect(names("   ")).toEqual(["office-어양동", "k1", "k2"]);
  });
  it("이름 · 동 이름 · 띄어쓰기 다른 이름", () => {
    expect(names("어양동")).toEqual(["office-어양동", "k1"]);
    expect(names("어양동 행정복지센터")).toEqual(["office-어양동", "k1"]);
    expect(names("시청")).toEqual(["k2"]);
  });
  it("주소 · 설치 장소 상세로도 찾는다", () => {
    expect(names("인북로")).toEqual(["office-어양동", "k1", "k2"]);
    expect(names("로비")).toEqual(["k1"]);
  });
  it("종류 이름: 주민센터는 주민센터, 발급기는 발급기", () => {
    expect(names("주민센터")).toEqual(["office-어양동"]);
    expect(names("행정복지센터").sort()).toEqual(["k1", "office-어양동"].sort());
    expect(names("발급기")).toEqual(["k1", "k2"]);
    expect(names("무인")).toEqual(["k1", "k2"]);
  });
  it("한 글자는 종류 이름으로 보지 않는다", () => {
    expect(names("발")).toEqual([]);
    expect(names("주")).toEqual([]);
  });
  it("없는 곳은 아무것도", () => {
    expect(names("없는곳")).toEqual([]);
  });
  it("MIN_MAP_LEVEL 은 4", () => {
    expect(MIN_MAP_LEVEL).toBe(4);
  });
});
