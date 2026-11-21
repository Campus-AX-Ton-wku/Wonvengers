// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLedger, toggleLine } from "@/lib/ledger";
import { clearLedger, loadLedger, onLocalChange, resetAllAnswers, saveLedger, writeLocalContent } from "@/lib/storage";
import { emptyContent } from "@/lib/user-data";

const KEY = "perky.ledger";
const 기록 = toggleLine(emptyLedger(), "2026-11", "rent", 400_000);

beforeEach(() => window.localStorage.clear());

describe("주거비 달력 저장 (perky.ledger)", () => {
  it("저장한 기록을 그대로 읽는다. 없거나 깨졌으면 빈 기록", () => {
    expect(loadLedger()).toEqual(emptyLedger());
    saveLedger(기록);
    expect(loadLedger()).toEqual(기록);
    window.localStorage.setItem(KEY, "{깨짐");
    expect(loadLedger()).toEqual(emptyLedger());
  });

  it("저장해도 동기화 알림을 보내지 않는다 — 서버에 올리는 내용이 아니다", () => {
    const listener = vi.fn();
    const off = onLocalChange(listener);
    saveLedger(기록);
    off();
    expect(listener).not.toHaveBeenCalled();
  });

  it("서버 값으로 사본을 덮어써도(로그인) 달력 기록은 남는다", () => {
    saveLedger(기록);
    writeLocalContent(emptyContent());
    expect(loadLedger()).toEqual(기록);
  });

  it("'처음부터 다시'와 clearLedger 는 달력 기록을 지운다", () => {
    saveLedger(기록);
    resetAllAnswers();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    saveLedger(기록);
    clearLedger();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
