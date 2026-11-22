// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CivilPlace } from "@/lib/places";

vi.mock("@/lib/kakao-map", () => ({ loadKakaoMaps: vi.fn(() => Promise.reject(new Error("no-key"))) }));

import { PlacesView } from "@/app/guides/places/PlacesView";

const base: Omit<CivilPlace, "id" | "kind" | "name" | "lat" | "lng"> = {
  address: "전북특별자치도 익산시 인북로32길 1",
  detail: null,
  phone: null,
  weekday: null,
  holiday: null,
  hoursNote: null,
  documents: [],
};
const PLACES: CivilPlace[] = [
  { ...base, id: "office-어양동", kind: "office", name: "어양동행정복지센터", phone: "063-859-4808", lat: 35.96, lng: 126.97 },
  { ...base, id: "kiosk-405", kind: "kiosk", name: "익산시청", detail: "익산시청 광장", weekday: "24시간", holiday: "24시간", lat: 35.9483, lng: 126.9577, documents: ["resident", "family"] },
  { ...base, id: "kiosk-407", kind: "kiosk", name: "익산역", detail: "익산역사 내", weekday: "03:00~23:50", lat: 35.9405, lng: 126.9466, documents: ["resident"] },
];

beforeEach(() => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
});
afterEach(() => vi.clearAllMocks());

describe("서류 떼는 곳 지도 /guides/places", () => {
  it("지도를 못 불러오면 알리고 목록을 보여 준다", async () => {
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(await screen.findByText("지도를 불러오지 못했어요 — 목록으로 보여 드려요")).toBeTruthy();
    const list = screen.getByRole("list", { name: "장소 목록" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("어양동행정복지센터"),
      expect.stringContaining("익산시청"),
      expect.stringContaining("익산역"),
    ]);
  });

  it("종류 칩 · 서류 칩으로 거른다 — 서류 칩은 발급기를 골랐을 때만", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(screen.queryByRole("button", { name: "가족관계증명서" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "무인민원발급기" }));
    const list = screen.getByRole("list", { name: "장소 목록" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "가족관계증명서" }));
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("익산시청")]);
  });

  it("장소를 누르면 카드 — 운영시간 · 뗄 수 있는 서류 · 길찾기 새 창 · 주민센터는 전화", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: /익산시청/ }));
    const card = screen.getByRole("region", { name: "익산시청" });
    expect(within(card).getByText("평일 24시간")).toBeTruthy();
    expect(within(card).getByText("뗄 수 있는 서류: 주민등록등본 · 가족관계증명서")).toBeTruthy();
    const go = within(card).getByRole("link", { name: /길찾기/ });
    expect(go.getAttribute("href")).toBe(`https://map.kakao.com/link/to/${encodeURIComponent("익산시청")},35.9483,126.9577`);
    expect(go.getAttribute("target")).toBe("_blank");

    await user.click(screen.getByRole("button", { name: /어양동행정복지센터/ }));
    const office = screen.getByRole("region", { name: "어양동행정복지센터" });
    expect(within(office).getByRole("link", { name: /전화/ }).getAttribute("href")).toBe("tel:0638594808");
  });

  it("장소를 고르면 포커스가 카드로 옮겨 간다", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: /익산시청/ }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "익산시청" }));
  });

  it("내 위치 — 권한이 없으면 알리고, 있으면 가까운 순 + 거리", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: "내 위치" }));
    expect(screen.getByText("위치 권한이 없어 익산 전체를 보여 드려요")).toBeTruthy();
    unmount();

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 35.9405, longitude: 126.9466 } } as GeolocationPosition) },
    });
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: "내 위치" }));
    const list = screen.getByRole("list", { name: "장소 목록" });
    const first = within(list).getAllByRole("button")[0];
    expect(first.textContent).toContain("익산역");
    expect(first.textContent).toContain("직선 0m");
  });

  it("내 위치 — 익산에서 먼 곳이면 알리고 목록은 그대로", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 37.5665, longitude: 126.978 } } as GeolocationPosition) },
    });
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: "내 위치" }));
    expect(screen.getAllByRole("status")[0].textContent).toBe("지금 계신 곳이 익산에서 멀어 익산 전체를 보여 드려요");
    expect(within(screen.getByRole("list", { name: "장소 목록" })).getAllByRole("button")).toHaveLength(3);
  });

  it("내 위치 — 가까우면 알림 영역에 안내, 시간 초과 같은 오류는 다른 문구", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 35.9405, longitude: 126.9466 } } as GeolocationPosition) },
    });
    const { unmount } = render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(screen.getAllByRole("status")[0].textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "내 위치" }));
    expect(screen.getAllByRole("status")[0].textContent).toBe("가까운 순으로 바꿨어요");
    unmount();

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => err({ code: 3 } as GeolocationPositionError) },
    });
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.click(screen.getByRole("button", { name: "내 위치" }));
    expect(screen.getAllByRole("status")[0].textContent).toBe("위치를 찾지 못해 익산 전체를 보여 드려요");
  });

  it("서류 칩은 데이터에 있는 서류만 — 칩 묶음에 이름이 있다", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(screen.getByRole("group", { name: "장소 종류" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "무인민원발급기" }));
    const docs = within(screen.getByRole("group", { name: "서류" }));
    expect(docs.getByRole("button", { name: "주민등록등본" })).toBeTruthy();
    expect(docs.queryByRole("button", { name: "등기부등본" })).toBeNull();
  });

  it("이름으로 찾기 — 시청을 치면 익산시청만 남고 결과 수를 알린다", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    const search = screen.getByRole("search");
    expect(within(search).getByLabelText("장소나 동 이름으로 찾기")).toBeTruthy();
    expect(screen.getByPlaceholderText("장소나 동 이름으로 찾기 (예: 어양동, 시청, 익산역)")).toBeTruthy();
    await user.type(screen.getByRole("searchbox"), "시청");
    const list = screen.getByRole("list", { name: "장소 목록" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("익산시청")]);
    expect(screen.getByText("1곳을 찾았어요").getAttribute("role")).toBe("status");
  });

  it("찾는 곳이 없으면 검색어를 넣어 알린다 — 칩만 고른 빈 결과는 기존 문구", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.type(screen.getByRole("searchbox"), " 없는곳 ");
    expect(screen.getByText("'없는곳'에 맞는 곳이 없어요")).toBeTruthy();
    expect(screen.queryByText("조건에 맞는 곳이 없어요")).toBeNull();
  });

  it("검색어 지우기 — 모두 돌아오고 입력칸에 포커스", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(screen.queryByRole("button", { name: "검색어 지우기" })).toBeNull();
    await user.type(screen.getByRole("searchbox"), "시청");
    await user.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(within(screen.getByRole("list", { name: "장소 목록" })).getAllByRole("button")).toHaveLength(3);
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    expect(screen.queryByRole("button", { name: "검색어 지우기" })).toBeNull();
  });

  it("검색은 종류 칩과 함께 걸린다", async () => {
    const user = userEvent.setup();
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    await user.type(screen.getByRole("searchbox"), "어양동");
    expect(within(screen.getByRole("list", { name: "장소 목록" })).getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "무인민원발급기" }));
    expect(screen.getByText("'어양동'에 맞는 곳이 없어요")).toBeTruthy();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "익산");
    expect(within(screen.getByRole("list", { name: "장소 목록" })).getAllByRole("button")).toHaveLength(2);
  });

  it("장소가 없으면 안내 + 가이드 1장 링크", () => {
    render(<PlacesView places={[]} generatedAt={null} jsKey={undefined} />);
    expect(screen.getByText("아직 보여 줄 곳이 없어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /온라인으로 떼는 곳 보기/ }).getAttribute("href")).toBe("/guides/where-documents/1");
  });

  it("출처를 적는다", () => {
    render(<PlacesView places={PLACES} generatedAt="2026-11-22" jsKey={undefined} />);
    expect(screen.getByText(/행정안전부 무인민원발급기정보 · 카카오 장소 · 주소 검색 · 2026-11-22 기준/)).toBeTruthy();
  });
});
