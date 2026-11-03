// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsultCenters from "@/app/find/ConsultCenters";

const center = {
  id: "iksan-youth-center",
  name: "익산청년시청",
  regionScope: "전북특별자치도 익산시",
  phone: "063-000-0000",
  url: null,
  hours: "평일 09:00~18:00",
  topics: ["청년 주거", "월세 지원 신청"],
  verifiedAt: "2026-11-04",
  notes: "내부 메모 — 화면에 나오면 안 된다",
};

describe("지역 상담 창구 카드", () => {
  it("창구가 없으면 카드를 그리지 않는다", () => {
    const { container } = render(<ConsultCenters centers={[]} regionLabel="익산시" />);
    expect(container.innerHTML).toBe("");
  });

  it("접힌 카드 라벨에 지역과 창구 수가 있다", () => {
    render(<ConsultCenters centers={[center]} regionLabel="익산시" />);
    expect(screen.getByText("익산시에서 상담받을 수 있는 곳 1곳")).toBeTruthy();
  });

  it("창구마다 이름·tel 링크·운영 시간·주제를 보여주고 notes 는 숨긴다", () => {
    render(<ConsultCenters centers={[center]} regionLabel="익산시" />);
    expect(screen.getByText("익산청년시청")).toBeTruthy();
    expect(screen.getByRole("link", { name: /063-000-0000/ }).getAttribute("href")).toBe("tel:0630000000");
    expect(screen.getByText(/평일 09:00~18:00/)).toBeTruthy();
    expect(screen.getByText(/청년 주거 · 월세 지원 신청/)).toBeTruthy();
    expect(screen.queryByText(/내부 메모/)).toBeNull();
  });
});
