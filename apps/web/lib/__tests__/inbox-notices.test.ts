import { describe, expect, it } from "vitest";
import { noticeInboxItems } from "../inbox";
import { EMPTY_ANSWERS } from "../storage";
import type { HousingNotice } from "../notices";

const TODAY = "2026-11-22";
const n = (id: string, over: Partial<HousingNotice> = {}): HousingNotice => ({
  id, source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", title: id, supplier: "LH",
  announcedAt: "2026-11-20", applyStart: "2026-11-20", applyEnd: "2026-12-30", url: "https://apply.lh.or.kr/x", address: null, ...over,
});
const 익산 = { ...EMPTY_ANSWERS, region: "전북특별자치도 익산시" };

describe("알림함 — 새 청약 공고 (11/22)", () => {
  it("모집공고일 14일 이내 · 끝나지 않은 공고, 최근 공고가 먼저, 키는 notice:{id}", () => {
    const items = noticeInboxItems([
      n("열흘 전", { announcedAt: "2026-11-12" }),
      n("이틀 전"),
      n("보름 전", { announcedAt: "2026-11-07" }),
      n("어제 끝남", { applyEnd: "2026-11-21" }),
      n("공고일 모름", { announcedAt: null }),
    ], 익산, TODAY);
    expect(items.map((i) => [i.notice.id, i.days, i.key])).toEqual([
      ["이틀 전", 2, "notice:이틀 전"],
      ["열흘 전", 10, "notice:열흘 전"],
    ]);
  });
  it("사는 곳을 답하지 않았거나 익산이 아니면 띄우지 않는다", () => {
    expect(noticeInboxItems([n("a")], EMPTY_ANSWERS, TODAY)).toEqual([]);
    expect(noticeInboxItems([n("a")], { ...EMPTY_ANSWERS, region: "전북특별자치도" }, TODAY)).toEqual([]);
  });
});
