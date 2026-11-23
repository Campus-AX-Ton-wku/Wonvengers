// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLedger, toggleLine } from "@/lib/ledger";
import { clearLedger, loadLedger, onLocalChange, readLocalContent, resetAllAnswers, saveLedger, writeLocalContent } from "@/lib/storage";
import { MAX_LEDGER_MONTHS, emptyContent } from "@/lib/user-data";

const KEY = "perky.ledger";
const 기록 = toggleLine(emptyLedger(), "2026-11", "rent", 400_000);
const 다른기록 = toggleLine(emptyLedger(), "2026-12", "fee", 50_000);

beforeEach(() => window.localStorage.clear());

describe("주거비 달력 저장 (perky.ledger)", () => {
  it("저장한 기록을 그대로 읽는다. 없거나 깨졌으면 빈 기록", () => {
    expect(loadLedger()).toEqual(emptyLedger());
    saveLedger(기록);
    expect(loadLedger()).toEqual(기록);
    window.localStorage.setItem(KEY, "{깨짐");
    expect(loadLedger()).toEqual(emptyLedger());
  });

  it("저장하면 동기화 알림을 보낸다 — 11/23 부터 계정에 저장(lib/sync.ts 가 모아서 올린다)", () => {
    const listener = vi.fn();
    const off = onLocalChange(listener);
    saveLedger(기록);
    off();
    expect(listener).toHaveBeenCalledWith({ immediate: false });
  });

  it("사본 묶음에 들어간다 — 읽기 · 서버 값으로 덮어쓰기 · 비운 계정이면 이 기기 기록도 비운다", () => {
    saveLedger(기록);
    expect(readLocalContent().ledger).toEqual(기록);
    writeLocalContent({ ...emptyContent(), ledger: 다른기록 });
    expect(loadLedger()).toEqual(다른기록);
    writeLocalContent(emptyContent());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("다 취소해 빈 기록은 사본 묶음에서 null — 기록 없음과 같다", () => {
    saveLedger(toggleLine(기록, "2026-11", "rent", 400_000));
    expect(readLocalContent().ledger).toBeNull();
  });

  it("10년(120달)을 넘으면 올릴 때 최근 달만 남긴다 — 한 칸 때문에 기록 전체를 못 올리지 않게", () => {
    let many = emptyLedger();
    for (let i = 0; i < MAX_LEDGER_MONTHS + 5; i++) {
      const y = 2020 + Math.floor(i / 12);
      const m = String((i % 12) + 1).padStart(2, "0");
      many = toggleLine(many, `${y}-${m}`, "rent", 300_000);
    }
    saveLedger(many);
    const months = Object.keys(readLocalContent().ledger!.months).sort();
    expect(months).toHaveLength(MAX_LEDGER_MONTHS);
    expect(months[0]).toBe("2020-06");
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
