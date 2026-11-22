// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  badgesSeen, clearDeviceRecords, clearLocalContent, loadGuidesRead, markBadgesSeen, markGuideRead, onDeviceRecordChange,
  onLocalChange, readLocalContent, resetAllAnswers, saveLedger,
} from "@/lib/storage";
import { emptyLedger, toggleLine } from "@/lib/ledger";

/** 내 프로필 ② — 가이드 읽음 · 처음 판정 표시는 이 기기에만 (설계 §7) */

beforeEach(() => window.localStorage.clear());

describe("가이드 읽음 기록 (perky.guides-read)", () => {
  it("끝 장을 연 가이드를 겹치지 않게 남기고, 모르는 가이드는 버린다", () => {
    expect(loadGuidesRead()).toEqual([]);
    markGuideRead("before-contract");
    markGuideRead("before-contract");
    markGuideRead("protect-deposit");
    expect(loadGuidesRead()).toEqual(["before-contract", "protect-deposit"]);
    window.localStorage.setItem("perky.guides-read", JSON.stringify(["before-contract", "nope", 3]));
    expect(loadGuidesRead()).toEqual(["before-contract"]);
  });

  it("이 기기에만 — 동기화 알림 대신 기기 기록 알림, 사본 묶음에 없음, 로그인으로 덮어써도 남음", () => {
    const local = vi.fn();
    const device = vi.fn();
    const offLocal = onLocalChange(local);
    const offDevice = onDeviceRecordChange(device);
    markGuideRead("where-documents");
    offLocal();
    offDevice();
    expect(local).not.toHaveBeenCalled();
    expect(device).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(readLocalContent())).not.toContain("where-documents");
    clearLocalContent();
    expect(loadGuidesRead()).toEqual(["where-documents"]);
  });

  it("로그아웃 · 탈퇴 · '처음부터 다시'(clearDeviceRecords)에서 지운다 — 처음 판정 표시도", () => {
    markGuideRead("before-contract");
    markBadgesSeen();
    resetAllAnswers();
    expect(loadGuidesRead()).toEqual([]);
    expect(badgesSeen()).toBe(false);
    markGuideRead("before-contract");
    clearDeviceRecords();
    expect(loadGuidesRead()).toEqual([]);
  });
});

describe("기기 기록 알림", () => {
  it("주거비 달력을 저장하면 알린다 — 배지 판정이 다시 본다", () => {
    const device = vi.fn();
    const off = onDeviceRecordChange(device);
    saveLedger(toggleLine(emptyLedger(), "2026-11", "rent", 400_000));
    off();
    expect(device).toHaveBeenCalledTimes(1);
  });
});
