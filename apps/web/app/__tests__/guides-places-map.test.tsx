// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CivilPlace } from "@/lib/places";
import { MIN_MAP_LEVEL } from "@/lib/places";

/* 가짜 카카오 SDK — 지도가 준비된 길(마커 묶음 · 처음 화면 · 확대 한도)을 확인한다 */
interface Pt { lat: number; lng: number }
const rec = vi.hoisted(() => ({
  maps: [] as { setBounds: ReturnType<typeof vi.fn>; setLevel: ReturnType<typeof vi.fn>; setCenter: ReturnType<typeof vi.fn> }[],
  bounds: [] as { points: Pt[] }[],
  overlays: [] as { opts: Record<string, unknown>; setMap: ReturnType<typeof vi.fn> }[],
  clusterers: [] as { opts: Record<string, unknown>; addMarkers: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> }[],
  calls: [] as string[],
}));

vi.mock("@/lib/kakao-map", () => {
  const maps = {
    Map: function (this: unknown) {
      const m = { setBounds: vi.fn(), setCenter: vi.fn(), setLevel: vi.fn(), getLevel: vi.fn(() => 2), relayout: vi.fn() };
      rec.maps.push(m);
      return m;
    },
    LatLng: function (this: Pt, lat: number, lng: number) {
      this.lat = lat;
      this.lng = lng;
    },
    LatLngBounds: function () {
      const b = { points: [] as Pt[], extend(p: Pt) { b.points.push(p); } };
      rec.bounds.push(b);
      return b;
    },
    CustomOverlay: function (opts: Record<string, unknown>) {
      const o = { opts, setMap: vi.fn() };
      rec.overlays.push(o);
      return o;
    },
    MarkerClusterer: function (opts: Record<string, unknown>) {
      const c = { opts, addMarkers: vi.fn(() => rec.calls.push("add")), clear: vi.fn(() => rec.calls.push("clear")) };
      rec.clusterers.push(c);
      return c;
    },
  };
  return { loadKakaoMaps: vi.fn(() => Promise.resolve(maps)) };
});

import { PlacesView } from "@/app/guides/places/PlacesView";

const base: Omit<CivilPlace, "id" | "kind" | "name" | "lat" | "lng"> = {
  address: "전북특별자치도 익산시 인북로32길 1",
  detail: null, phone: null, weekday: null, holiday: null, hoursNote: null, documents: [],
};
const PLACES: CivilPlace[] = [
  { ...base, id: "office-어양동", kind: "office", name: "어양동행정복지센터", lat: 35.96, lng: 126.97 },
  { ...base, id: "kiosk-405", kind: "kiosk", name: "익산시청", lat: 35.9483, lng: 126.9577 },
  { ...base, id: "kiosk-410", kind: "kiosk", name: "함열읍사무소", address: "전북특별자치도 익산시 함열읍 함열중앙로 83", lat: 36.09, lng: 126.95 },
];

beforeEach(() => {
  rec.calls.length = 0; // 앞 시험의 정리(unmount)가 afterEach 뒤에 남긴 호출을 버린다
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
});
afterEach(() => {
  vi.clearAllMocks();
  rec.maps.length = rec.bounds.length = rec.overlays.length = rec.clusterers.length = rec.calls.length = 0;
});

describe("지도가 준비된 길", () => {
  it("처음엔 시내 장소만 화면에 맞추고, 겹친 표시는 묶음에 맡긴다", async () => {
    render(<PlacesView places={PLACES} generatedAt={null} jsKey="k" />);
    await vi.waitFor(() => expect(rec.clusterers[0]?.addMarkers).toHaveBeenCalledTimes(1));
    const cl = rec.clusterers[0];
    expect(cl.opts).toMatchObject({ averageCenter: true, minLevel: 6, gridSize: 48, disableClickZoom: false });
    expect(cl.opts.map).toBe(rec.maps[0]);
    expect((cl.opts.styles as unknown[]).length).toBe(1);
    const added = cl.addMarkers.mock.calls[0][0] as typeof rec.overlays;
    expect(added).toHaveLength(PLACES.length);
    for (const o of added) {
      expect(o.opts.map).toBeUndefined();
      expect(o.opts.clickable).toBe(true);
    }
    expect(rec.maps[0].setBounds).toHaveBeenCalledTimes(1);
    expect(rec.maps[0].setBounds.mock.calls[0][0].points).toHaveLength(2); // 함열읍 제외
    expect(rec.maps[0].setLevel).not.toHaveBeenCalled(); // 걸러진 게 없으면 확대 한도는 안 건다
  });

  it("종류 칩을 고르면 지우고 다시 담고, 너무 가까이 확대되지 않게 한다", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt={null} jsKey="k" />);
    await vi.waitFor(() => expect(rec.clusterers[0]?.addMarkers).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "무인민원발급기" }));
    const cl = rec.clusterers[0];
    await vi.waitFor(() => expect(cl.addMarkers).toHaveBeenCalledTimes(2));
    expect(cl.clear).toHaveBeenCalled();
    const second = cl.addMarkers.mock.calls[1][0] as typeof rec.overlays;
    expect(second).toHaveLength(2);
    const map = rec.maps[0];
    expect(map.setBounds).toHaveBeenCalledTimes(2);
    expect(map.setBounds.mock.calls[1][0].points).toHaveLength(2); // 발급기 둘 (함열읍 포함)
    expect(map.setLevel).toHaveBeenCalledWith(MIN_MAP_LEVEL);
    // 다시 그릴 때는 항상 지운 뒤에 담는다
    expect(rec.calls.slice(0, 4)).toEqual(["clear", "add", "clear", "add"]);
  });

  it("화면을 닫으면 묶음을 비워 표시가 남지 않게 한다", async () => {
    const { unmount } = render(<PlacesView places={PLACES} generatedAt={null} jsKey="k" />);
    await vi.waitFor(() => expect(rec.clusterers[0]?.addMarkers).toHaveBeenCalledTimes(1));
    rec.clusterers[0].clear.mockClear();
    unmount();
    expect(rec.clusterers[0].clear).toHaveBeenCalledTimes(1);
  });
});
