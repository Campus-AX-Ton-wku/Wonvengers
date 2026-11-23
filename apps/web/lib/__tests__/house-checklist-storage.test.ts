// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOUSE_CHECKLIST_KEY,
  clearHouseChecklist,
  clearDeviceRecords,
  loadHouseChecklist,
  onLocalChange,
  resetAllAnswers,
  saveHouseChecklist,
  saveLedger,
  readLocalContent,
  writeLocalContent,
} from "@/lib/storage";
import { emptyLedger, toggleLine } from "@/lib/ledger";
import { emptyContent } from "@/lib/user-data";

beforeEach(() => window.localStorage.clear());

describe("체크리스트 기록 (perky.house-checklist)", () => {
  it("저장한 체크를 읽는다. 없거나 깨졌거나 모르는 id 는 버린다", () => {
    expect(loadHouseChecklist()).toEqual([]);
    saveHouseChecklist(["water", "night"]);
    expect(loadHouseChecklist()).toEqual(["water", "night"]);
    window.localStorage.setItem(HOUSE_CHECKLIST_KEY, JSON.stringify({ v: 1, checked: ["water", "옛 항목"] }));
    expect(loadHouseChecklist()).toEqual(["water"]);
    window.localStorage.setItem(HOUSE_CHECKLIST_KEY, "{깨짐");
    expect(loadHouseChecklist()).toEqual([]);
  });

  it("저장하면 동기화 알림을 보내고(11/23 부터 계정에 저장), 사본 묶음에는 이름순으로 들어간다", () => {
    const listener = vi.fn();
    const off = onLocalChange(listener);
    saveHouseChecklist(["water", "mold"]);
    off();
    expect(listener).toHaveBeenCalledWith({ immediate: false });
    expect(readLocalContent().houseChecklist).toEqual(["mold", "water"]);
  });

  it("서버 값으로 덮어쓰면 서버의 체크가 된다 — 비어 있으면 이 기기 체크도 비운다", () => {
    saveHouseChecklist(["water"]);
    writeLocalContent({ ...emptyContent(), houseChecklist: ["light", "mold"] });
    expect(loadHouseChecklist()).toEqual(["light", "mold"]);
    writeLocalContent(emptyContent());
    expect(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)).toBeNull();
  });

  it("clearHouseChecklist · '처음부터 다시' · clearDeviceRecords 는 체크를 지운다(달력도 함께)", () => {
    saveHouseChecklist(["water"]);
    clearHouseChecklist();
    expect(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)).toBeNull();
    saveHouseChecklist(["water"]);
    resetAllAnswers();
    expect(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)).toBeNull();
    saveHouseChecklist(["water"]);
    saveLedger(toggleLine(emptyLedger(), "2026-11", "rent", 400_000));
    clearDeviceRecords();
    expect(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)).toBeNull();
    expect(window.localStorage.getItem("perky.ledger")).toBeNull();
  });
});
