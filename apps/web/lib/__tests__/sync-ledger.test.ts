// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import { resetAuthForTests } from "@/lib/auth";
import { emptyLedger, toggleLine } from "@/lib/ledger";
import { reloadPage } from "@/lib/redirect";
import { loadRemote, saveRemote } from "@/lib/remote";
import { loadHouseChecklist, loadLedger, readLocalContent, saveAnswers, saveHouseChecklist, saveLedger } from "@/lib/storage";
import { SAVE_DEBOUNCE_MS, SYNC_META_KEY, getSyncState, logout, resetSyncForTests, startSync } from "@/lib/sync";
import { contentFingerprint } from "@/lib/user-data";
import { enableLogin, remoteItem, seedSyncMeta, signInAs } from "./auth-fixtures";

/** 주거비 달력 · 집 보기 체크리스트 계정 저장 (11/23 ggue) — 동기화 흐름 */

const 답 = {
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const T0 = "2026-11-04T09:00:00.000Z";
const T1 = "2026-11-23T09:00:00.000Z";
const 기록 = toggleLine(emptyLedger(), "2026-11", "rent", 400_000);
const load = vi.mocked(loadRemote);
const save = vi.mocked(saveRemote);
const meta = () => JSON.parse(window.localStorage.getItem(SYNC_META_KEY) ?? "null");

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
  load.mockReset();
  save.mockReset();
  vi.mocked(reloadPage).mockReset();
  enableLogin();
  signInAs("sub-a");
});

afterEach(() => {
  resetSyncForTests();
  vi.useRealTimers();
});

describe("누르면 계정에 올린다", () => {
  it("달력 · 체크리스트를 바꾸면 1.5초 모아 한 번 PUT — 두 칸이 본문에 들어간다", async () => {
    vi.useFakeTimers();
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    load.mockResolvedValueOnce(remoteItem({}, T0));
    startSync();
    await settle();
    save.mockResolvedValue({ ok: true, updatedAt: T1 });

    saveLedger(기록);
    saveHouseChecklist(["water"]);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    const [payload] = save.mock.calls[0];
    expect(payload.ledger).toEqual(기록);
    expect(payload.houseChecklist).toEqual(["water"]);
  });
});

describe("11/23 전 이 기기에만 있던 기록 — 한 번 올린다", () => {
  /** 업데이트 전 앱이 남긴 메타: 지문에 달력 · 체크리스트가 없다 */
  function seedOldMeta(): void {
    const before = { ...readLocalContent(), ledger: null, houseChecklist: [] };
    window.localStorage.setItem(
      SYNC_META_KEY,
      JSON.stringify({ sub: "sub-a", baseUpdatedAt: T0, lastSavedAt: T0, dirty: false, syncedHash: contentFingerprint(before) })
    );
  }

  it("서버와 맞춘 뒤 고친 것이 없어도, 이 기기에만 있던 기록이 있으면 페이지를 열 때 올린다", async () => {
    saveAnswers(답);
    saveLedger(기록);
    saveHouseChecklist(["mold"]);
    seedOldMeta();
    save.mockResolvedValue({ ok: true, updatedAt: T1 });

    startSync();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [payload, base] = save.mock.calls[0];
    expect(payload.ledger).toEqual(기록);
    expect(payload.houseChecklist).toEqual(["mold"]);
    expect(base).toBe(T0);
    await vi.waitFor(() => expect(meta().dirty).toBe(false));
    expect(meta().syncedHash).toBe(contentFingerprint(readLocalContent()));
  });

  it("올린 뒤 다시 열면 또 올리지 않는다", async () => {
    saveAnswers(답);
    saveLedger(기록);
    window.localStorage.setItem(
      SYNC_META_KEY,
      JSON.stringify({ sub: "sub-a", baseUpdatedAt: T1, lastSavedAt: T1, dirty: false, syncedHash: contentFingerprint(readLocalContent()) })
    );
    load.mockResolvedValueOnce(remoteItem({ answers: readLocalContent().answers, ledger: 기록 }, T1));
    startSync();
    await settle();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(save).not.toHaveBeenCalled();
  });

  it("기록이 없는 사람은 아무것도 올리지 않는다 — 서버 배포 전에도 평소대로", async () => {
    saveAnswers(답);
    seedOldMeta();
    load.mockResolvedValueOnce(remoteItem({ answers: readLocalContent().answers }, T0));
    startSync();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe("idle");
  });
});

describe("다른 기기에서 이어 보기", () => {
  it("서버 값이 바뀌었으면 달력 · 체크리스트도 서버 값으로 바꾸고 화면을 다시 연다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    load.mockResolvedValueOnce(remoteItem({ ledger: 기록, houseChecklist: ["light", "water"] }, T1));
    startSync();
    await vi.waitFor(() => expect(reloadPage).toHaveBeenCalled());
    expect(loadLedger()).toEqual(기록);
    expect(loadHouseChecklist()).toEqual(["light", "water"]);
  });

  it("로그아웃하면 이 기기 사본만 지운다 — 서버로 빈 값을 올리지 않는다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    load.mockResolvedValueOnce(remoteItem({ ledger: 기록 }, T0));
    saveLedger(기록);
    window.localStorage.setItem(
      SYNC_META_KEY,
      JSON.stringify({ sub: "sub-a", baseUpdatedAt: T0, lastSavedAt: T0, dirty: false, syncedHash: contentFingerprint(readLocalContent()) })
    );
    startSync();
    await settle();
    await logout();
    expect(window.localStorage.getItem("perky.ledger")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
