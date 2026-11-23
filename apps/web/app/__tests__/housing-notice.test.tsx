// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const fx = vi.hoisted(() => {
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const day = (n: number) => new Date(Date.parse(today) + n * 86_400_000).toISOString().slice(0, 10);
  const base = (id: string, over: Record<string, unknown> = {}) => ({
    id, source: "마이홈포털", kind: "공공임대", typeLabel: "영구임대", title: id, supplier: "LH",
    announcedAt: day(-3), applyStart: day(-1), applyEnd: day(3), url: `https://apply.lh.or.kr/${id}`, address: null, ...over,
  });
  return {
    day,
    snapshot: {
      generatedAt: `${today}T06:00:00+09:00`,
      notices: [
        base("myhome:21525", {
          title: "익산 영구임대 예비입주자 모집",
          detail: {
            schedule: [{ label: "접수", start: day(-1), end: day(3) }, { label: "당첨자 발표", start: day(60), end: null }],
            facts: [],
            complexes: [
              { name: "익산부송1", address: "익산시 무왕로", households: 350, heating: "지역난방", amounts: [{ label: "임대보증금", won: 2520000 }, { label: "월 임대료", won: 50160 }] },
              { name: "익산동산", address: "익산시 동천로", households: 250, heating: "중앙난방", amounts: [] },
            ],
            houseTypes: null,
            contact: { department: "LH 콜센터 : 1600-1004", phone: "1600-1004", url: null },
          },
        }),
        base("applyhome:2026000559-2026000559", {
          source: "청약홈", kind: "아파트 분양", typeLabel: "아파트 분양", title: "두산위브 트레지움 익산", supplier: "재건축조합",
          detail: {
            schedule: [{ label: "1순위", start: day(1), end: null }],
            facts: [{ label: "입주 예정", value: "2030년 2월" }],
            complexes: [],
            houseTypes: [{ type: "59.85㎡ A", general: 11, special: 12, topPrice: 378_070_000 }],
            contact: null,
          },
        }),
        base("myhome:old", { title: "예전 스냅숏 공고" }),
        base("myhome:ended", { title: "끝난 공고", applyEnd: day(-1) }),
      ],
    },
  };
});
vi.mock("@/data/notices.json", () => ({ default: fx.snapshot }));

import NoticePage from "@/app/housing/notice/page";

const open = (id: string) => {
  window.history.replaceState(null, "", `/housing/notice?id=${encodeURIComponent(id)}`);
  render(<NoticePage />);
};
afterEach(cleanup);

describe("/housing/notice — 청약 공고 상세", () => {
  it("마이홈 공고 — 일정 · 단지마다 금액 · '가장 낮은 조건' 안내 · 문의 · 원문 버튼 (주소의 : 는 인코딩돼 온다)", async () => {
    open("myhome:21525");
    expect(await screen.findByRole("heading", { level: 1, name: "익산 영구임대 예비입주자 모집" })).toBeTruthy();
    const schedule = screen.getByRole("region", { name: "일정" });
    expect(within(schedule).getByText("당첨자 발표")).toBeTruthy();
    const complexes = screen.getByRole("region", { name: "단지" });
    expect(within(complexes).getByText("익산부송1")).toBeTruthy();
    expect(within(complexes).getByText("익산동산")).toBeTruthy();
    expect(within(complexes).getByText("252만원")).toBeTruthy();
    expect(within(complexes).getByText("5만 160원")).toBeTruthy();
    expect(within(complexes).getByText(/가장 낮은 조건 기준이에요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /1600-1004/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /공고문 보기/ }).getAttribute("href")).toBe("https://apply.lh.or.kr/myhome:21525");
  });

  it("청약홈 공고 — 주택형별 공급금액 표(최고가 기준) · 개요", async () => {
    open("applyhome:2026000559-2026000559");
    const table = await screen.findByRole("table", { name: /주택형별 공급금액/ });
    expect(within(table).getByText("59.85㎡ A")).toBeTruthy();
    expect(within(table).getByText("3억 7,807만원")).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "최고 공급금액" })).toBeTruthy();
    expect(screen.getByText("2030년 2월")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "단지" })).toBeNull();
  });

  it("detail 이 없는 공고(예전 스냅숏)도 기본 칸 · 원문 버튼으로 그린다", async () => {
    open("myhome:old");
    expect(await screen.findByRole("heading", { level: 1, name: "예전 스냅숏 공고" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "일정" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /공고문 보기/ })).toBeTruthy();
  });

  it("없는 공고 · 끝난 공고 → '끝났거나 내려간 공고예요' + 목록으로", async () => {
    open("myhome:nope");
    expect(await screen.findByText("끝났거나 내려간 공고예요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /익산 청약 공고 보기/ }).getAttribute("href")).toBe("/housing");
    cleanup();
    open("myhome:ended");
    expect(await screen.findByText("끝났거나 내려간 공고예요")).toBeTruthy();
  });

  it("자격은 판정하지 않는다 — 공고문에서 확인 안내", async () => {
    open("myhome:21525");
    expect(await screen.findByText(/자격과 소득 기준은 공고마다 달라요/)).toBeTruthy();
  });
});
