import { describe, expect, it } from "vitest";
import { groupNotices, homeNotices, kindsPresent, noticeDeadlineLabel, noticeStatus, snapshotDateLabel, type HousingNotice } from "../notices";

const TODAY = "2026-11-22";
const n = (id: string, over: Partial<HousingNotice> = {}): HousingNotice => ({
  id, source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", title: id, supplier: "LH",
  announcedAt: "2026-11-01", applyStart: "2026-11-01", applyEnd: "2026-12-30", url: "https://apply.lh.or.kr/x", address: null, ...over,
});

describe("상태 — 보는 날로 다시 센다(스냅숏은 아침 6시 것)", () => {
  it("접수 중 · 예정 · 끝남", () => {
    expect(noticeStatus(n("a"), TODAY)).toBe("open");
    expect(noticeStatus(n("b", { applyStart: "2026-11-23" }), TODAY)).toBe("upcoming");
    expect(noticeStatus(n("c", { applyEnd: "2026-11-21" }), TODAY)).toBe("ended");
    expect(noticeStatus(n("d", { applyEnd: "2026-11-22" }), TODAY)).toBe("open"); // 오늘 마감은 아직 접수 중
    expect(noticeStatus(n("e", { applyEnd: null }), TODAY)).toBe("open");
  });
});

describe("묶기", () => {
  const list = [
    n("늦게 마감", { applyEnd: "2027-01-10" }),
    n("곧 마감", { applyEnd: "2026-11-25" }),
    n("모레 시작", { applyStart: "2026-11-24" }),
    n("내일 시작", { applyStart: "2026-11-23", kind: "아파트 분양", typeLabel: "아파트 분양" }),
    n("어제 마감", { applyEnd: "2026-11-21", kind: "공공분양" }),
  ];
  it("접수 중은 마감 가까운 순, 예정은 시작 가까운 순, 끝난 공고는 없다", () => {
    const { open, upcoming } = groupNotices(list, TODAY);
    expect(open.map((x) => x.id)).toEqual(["곧 마감", "늦게 마감"]);
    expect(upcoming.map((x) => x.id)).toEqual(["내일 시작", "모레 시작"]);
  });
  it("종류로 거르기 · 남은 공고가 있는 종류만 칩으로", () => {
    expect(groupNotices(list, TODAY, "아파트 분양").upcoming.map((x) => x.id)).toEqual(["내일 시작"]);
    expect(kindsPresent(list, TODAY)).toEqual(["공공임대", "아파트 분양"]); // 공공분양은 끝난 것뿐
  });
  it("홈은 접수 중 → 예정 순으로 3장", () => {
    expect(homeNotices(list, TODAY).map((x) => x.id)).toEqual(["곧 마감", "늦게 마감", "내일 시작"]);
  });
});

describe("마감 표시 · 기준 날짜", () => {
  it("DeadlineBadge 가 아는 말로", () => {
    expect(noticeDeadlineLabel(n("a", { applyStart: "2026-11-23" }), TODAY)).toBe("신청 예정");
    expect(noticeDeadlineLabel(n("a", { applyEnd: null }), TODAY)).toBe("상시");
    expect(noticeDeadlineLabel(n("a", { applyEnd: "2026-11-22" }), TODAY)).toBe("오늘 마감");
    expect(noticeDeadlineLabel(n("a", { applyEnd: "2026-11-29" }), TODAY)).toBe("D-7");
  });
  it("스냅숏 시각 → '11월 22일', 없으면 null", () => {
    expect(snapshotDateLabel("2026-11-22T06:00:12+09:00")).toBe("11월 22일");
    expect(snapshotDateLabel(null)).toBeNull();
  });
});
