// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fx = vi.hoisted(() => {
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const day = (n: number) => new Date(Date.parse(today) + n * 86_400_000).toISOString().slice(0, 10);
  const n = (id: string, over: Record<string, unknown> = {}) => ({
    id, source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", title: id, supplier: "LH",
    announcedAt: day(-3), applyStart: day(-3), applyEnd: day(10), url: `https://apply.lh.or.kr/${id}`, address: null, ...over,
  });
  return {
    snapshot: {
      generatedAt: `${today}T06:00:00+09:00`,
      notices: [
        n("행복주택 추가모집"),
        n("두산위브 익산", { source: "청약홈", kind: "아파트 분양", typeLabel: "아파트 분양", supplier: "시행사", applyStart: day(5), applyEnd: day(6) }),
        n("어제 끝난 공고", { applyEnd: day(-1) }),
      ],
    },
  };
});
vi.mock("@/data/notices.json", () => ({ default: fx.snapshot }));

import HousingPage from "@/app/housing/page";

describe("/housing — 익산 청약 공고", () => {
  it("접수 중 · 접수 예정 두 묶음, 끝난 공고는 없다, 카드는 공고 상세로", async () => {
    render(<HousingPage />);
    const open = await screen.findByRole("region", { name: /접수 중/ });
    expect(within(open).getByRole("link", { name: /행복주택 추가모집/ }).getAttribute("href")).toBe(
      `/housing/notice?id=${encodeURIComponent("행복주택 추가모집")}`
    );
    const upcoming = screen.getByRole("region", { name: /접수 예정/ });
    expect(within(upcoming).getByText("두산위브 익산")).toBeTruthy();
    expect(screen.queryByText("어제 끝난 공고")).toBeNull();
  });

  it("자격은 판정하지 않는다 — '공고문에서 확인' 안내와 출처", async () => {
    render(<HousingPage />);
    expect(await screen.findByText(/자격과 소득 기준은 공고마다 달라요/)).toBeTruthy();
    expect(screen.getByText(/마이홈포털 · 청약홈/)).toBeTruthy();
    expect(screen.queryByText(/신청 가능|가능성 있음/)).toBeNull();
  });

  it("종류 칩 — 남은 공고가 있는 종류만, 누르면 그 종류만", async () => {
    const user = userEvent.setup();
    render(<HousingPage />);
    const chips = await screen.findByRole("group", { name: "공고 종류" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(["전체", "공공임대", "아파트 분양"]);
    await user.click(within(chips).getByRole("button", { name: "아파트 분양" }));
    expect(screen.queryByText("행복주택 추가모집")).toBeNull();
    expect(screen.getByText("두산위브 익산")).toBeTruthy();
  });
});
