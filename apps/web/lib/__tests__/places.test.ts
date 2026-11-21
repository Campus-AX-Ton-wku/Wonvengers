import { describe, expect, it } from "vitest";
import {
  KIOSK_DOCS,
  directionsUrl,
  distanceKm,
  filterPlaces,
  formatDistance,
  formatHours,
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

describe("formatHours — 데이터 값을 지어내지 않고 읽기 좋게만", () => {
  it("00:00~2400 은 24시간", () => expect(formatHours("00:00", "2400")).toBe("24시간"));
  it("2400 은 24:00 으로만 고쳐 쓴다", () => expect(formatHours("09:00", "2400")).toBe("09:00~24:00"));
  it("나머지는 그대로", () => {
    expect(formatHours("03:00", "23:50")).toBe("03:00~23:50");
    expect(formatHours("23:50", "03:00")).toBe("23:50~03:00");
  });
  it("값이 없으면 null — '운영 안 함'으로 짐작하지 않는다", () => {
    expect(formatHours("", "")).toBeNull();
    expect(formatHours("09:00", "")).toBeNull();
  });
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
