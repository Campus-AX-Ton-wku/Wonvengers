// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import { AUTH_KEY, CONSENT_KEY, resetAuthForTests } from "@/lib/auth";
import { goTo, reloadPage } from "@/lib/redirect";
import { deleteAccountRemote, loadRemote, saveRemote } from "@/lib/remote";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  loadChecklist,
  resetAllAnswers,
  saveAnswers,
  saveAnsweredKeys,
  saveChecklist,
} from "@/lib/storage";
import {
  SAVE_DEBOUNCE_MS,
  SYNC_META_KEY,
  flushNow,
  getSyncState,
  initialSync,
  logout,
  resetSyncForTests,
  resolveConflict,
  retrySync,
  startSync,
  stopSync,
  withdraw,
} from "@/lib/sync";
import { TEST_LOGOUT_URL, enableLogin, remoteItem, seedSyncMeta, signInAs } from "./auth-fixtures";

const 답 = {
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const T0 = "2026-11-04T09:00:00.000Z";
const load = vi.mocked(loadRemote);
const save = vi.mocked(saveRemote);
const meta = () => JSON.parse(window.localStorage.getItem(SYNC_META_KEY) ?? "null");

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  load.mockReset();
  save.mockReset();
  vi.mocked(deleteAccountRemote).mockReset();
  vi.mocked(goTo).mockReset();
  vi.mocked(reloadPage).mockReset();
  enableLogin();
  signInAs("sub-a");
});

afterEach(() => {
  resetSyncForTests();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** 대기 중인 약속(마이크로태스크)을 흘려보낸다. 가짜 타이머에서도 돈다. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/**
 * 이미 서버와 맞춘 기기가 페이지를 연 상태. 부팅 GET 은 같은 시각을 돌려준다.
 * startSync 는 상태를 곧바로 idle 로 두므로, GET 의 뒷처리까지 끝나기를 settle 로 기다린다.
 */
async function bootSynced(): Promise<void> {
  seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
  load.mockResolvedValueOnce(remoteItem({}, T0));
  startSync();
  expect(load).toHaveBeenCalledTimes(1);
  await settle();
  expect(getSyncState().status).toBe("idle");
}

describe("로그인 후 쓰기", () => {
  it("1.5초 모아 한 번만 PUT 한다 — 마지막 값과 마지막으로 본 서버 시각으로", async () => {
    vi.useFakeTimers();
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:00:05.000Z" });

    saveAnswers({ ...답, housingType: null });
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);

    const [payload, base] = save.mock.calls[0];
    expect(payload.answers.values).toEqual(답);
    expect(payload.consentVersion).toBe("2026-11-04");
    expect(base).toBe(T0);
    await vi.waitFor(() => expect(getSyncState()).toMatchObject({ status: "idle", lastSavedAt: "2026-11-04T09:00:05.000Z" }));
    expect(meta()).toMatchObject({ baseUpdatedAt: "2026-11-04T09:00:05.000Z", dirty: false });
  });

  it("'처음부터 다시'는 기다리지 않고 빈 데이터를 PUT 한다", async () => {
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:01:00.000Z" });
    saveAnswers(답);
    await flushNow(); // 서버에도 답이 있는 상태
    expect(save).toHaveBeenCalledTimes(1);

    resetAllAnswers();

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    const [payload] = save.mock.calls[1];
    expect(payload.answers).toEqual({ values: EMPTY_ANSWERS, answeredKeys: [] });
    expect(payload.listing).toBeNull();
    expect(payload.profile).toBeNull();
    expect(payload.declared).toBeNull();
    expect(payload.checklists).toEqual({});
  });

  it("실패하면 사본에 남기고 '저장 안 됨', 온라인이 되면 함께 올린다", async () => {
    await bootSynced();
    save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    saveAnswers(답);
    await retrySync();

    expect(getSyncState().status).toBe("error");
    expect(meta().dirty).toBe(true);
    expect(loadAnswers()).toEqual(답);

    save.mockResolvedValueOnce({ ok: true, updatedAt: "2026-11-04T09:10:00.000Z" });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(getSyncState().status).toBe("idle"));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].answers.values).toEqual(답);
    expect(meta().dirty).toBe(false);
  });
});

describe("409 충돌", () => {
  const 서버 = remoteItem(
    { answers: { values: { ...답, region: "서울특별시 중구" }, answeredKeys: ["birthDate", "region"] } },
    "2026-11-04T09:30:00.000Z"
  );

  it("충돌로 멈추고, '저장된 답'을 고르면 서버 값으로 맞춘다", async () => {
    await bootSynced();
    save.mockResolvedValueOnce({ ok: false, conflict: true });
    load.mockResolvedValueOnce(서버);
    saveAnswers(답);
    await retrySync();

    expect(getSyncState().status).toBe("conflict");
    expect(getSyncState().conflict?.updatedAt).toBe("2026-11-04T09:30:00.000Z");

    await resolveConflict("remote");
    expect(loadAnswers().region).toBe("서울특별시 중구");
    expect(getSyncState()).toMatchObject({ status: "idle", conflict: null });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("'이 기기의 답'을 고르면 서버 시각을 기준으로 다시 올린다", async () => {
    await bootSynced();
    save.mockResolvedValueOnce({ ok: false, conflict: true });
    load.mockResolvedValueOnce(서버);
    saveAnswers(답);
    await retrySync();

    save.mockResolvedValueOnce({ ok: true, updatedAt: "2026-11-04T09:31:00.000Z" });
    await resolveConflict("local");
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toBe("2026-11-04T09:30:00.000Z");
    expect(save.mock.calls[1][0].answers.values).toEqual(답);
    expect(loadAnswers()).toEqual(답);
  });
});

describe("처음 로그인 직후 (동의한 뒤)", () => {
  it("서버 항목이 없으면 이 기기 답을 올린다", async () => {
    saveAnswers(답);
    load.mockResolvedValueOnce(null);
    save.mockResolvedValueOnce({ ok: true, updatedAt: T0 });
    expect(await initialSync()).toBe("uploaded");
    expect(save.mock.calls[0][1]).toBeNull();
    expect(save.mock.calls[0][0].answers.values).toEqual(답);
  });

  it("서버 항목만 있으면 내려받아 채운다", async () => {
    load.mockResolvedValueOnce(remoteItem({ answers: { values: 답, answeredKeys: ["birthDate"] } }));
    expect(await initialSync()).toBe("downloaded");
    expect(loadAnswers()).toEqual(답);
    expect(save).not.toHaveBeenCalled();
    expect(meta()).toMatchObject({ baseUpdatedAt: T0, dirty: false });
  });

  it("둘 다 있고 다르면 묻는다 — 고르기 전에는 아무것도 바꾸지 않는다", async () => {
    saveAnswers(답);
    load.mockResolvedValueOnce(remoteItem({ answers: { values: { ...답, status: "재직" }, answeredKeys: [] } }));
    expect(await initialSync()).toBe("conflict");
    expect(getSyncState().status).toBe("conflict");
    expect(loadAnswers()).toEqual(답);
    expect(meta()).toBeNull();
  });

  it("둘이 같으면 묻지 않는다", async () => {
    saveAnswers(답);
    load.mockResolvedValueOnce(remoteItem({ answers: { values: 답, answeredKeys: [] } }));
    expect(await initialSync()).toBe("downloaded");
  });

  it("동의 전에는 부를 수 없다", async () => {
    signInAs("sub-b", { consent: false });
    await expect(initialSync()).rejects.toThrow("sync is not enabled");
    expect(load).not.toHaveBeenCalled();
  });
});

describe("페이지를 다시 열 때", () => {
  it("다른 기기가 저장했으면 사본을 서버 값으로 바꾸고 한 번 다시 연다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    saveAnswers(답);
    load.mockResolvedValueOnce(remoteItem({}, "2026-11-04T11:00:00.000Z"));
    startSync();
    await vi.waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
  });

  it("서버 시각이 그대로면 다시 열지 않는다", async () => {
    await bootSynced();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("다른 기기에서 탈퇴해 서버 항목이 없어졌으면 이 기기도 로그아웃하고 사본을 지운다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    saveAnswers(답);
    load.mockResolvedValueOnce(null);
    startSync();
    await vi.waitFor(() => expect(window.localStorage.getItem(AUTH_KEY)).toBeNull());
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("로그아웃·탈퇴", () => {
  it("로그아웃하면 남은 쓰기를 올리고, 이 기기의 사본을 지우고, Cognito 로그아웃으로 보낸다", async () => {
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:20:00.000Z" });
    saveAnswers(답);
    saveChecklist("iksan-newcomer-moving-cost-support", { eligibility: true, period: false, documents: false });
    window.localStorage.setItem("perky.onboarded", "1");

    await logout();

    expect(save).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
    expect(window.localStorage.getItem("perky.application-checklist:iksan-newcomer-moving-cost-support")).toBeNull();
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(window.localStorage.getItem("perky.onboarded")).toBe("1");
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
  });

  it("탈퇴하면 서버를 지운 뒤 사본·동의·로그인을 지우고, Cognito 로그아웃으로는 보내지 않는다", async () => {
    await bootSynced();
    saveAnswers(답);
    vi.mocked(deleteAccountRemote).mockResolvedValueOnce(undefined);

    await withdraw();

    expect(deleteAccountRemote).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
    expect(window.localStorage.getItem(CONSENT_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("서버 삭제가 실패하면 던지고 아무것도 지우지 않는다", async () => {
    await bootSynced();
    saveAnswers(답);
    vi.mocked(deleteAccountRemote).mockRejectedValueOnce(new Error("500"));
    load.mockResolvedValue(remoteItem({}, T0));

    await expect(withdraw()).rejects.toThrow("500");

    expect(loadAnswers()).toEqual(답);
    expect(window.localStorage.getItem(AUTH_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(CONSENT_KEY)).not.toBeNull();
  });

  it("탈퇴는 모아 둔 PUT 을 버린다 — 탈퇴 요청이 가는 동안에도, 끝난 뒤에도 PUT 이 나가지 않는다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:20:00.000Z" });
    let finishDelete!: () => void;
    vi.mocked(deleteAccountRemote).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishDelete = resolve))
    );
    saveAnswers(답);

    const done = withdraw();
    await vi.advanceTimersByTimeAsync(60_000);
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).not.toHaveBeenCalled();

    finishDelete();
    await done;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).not.toHaveBeenCalled();
  });

  it("stopSync 뒤에는 모아 둔 PUT 이 나가지 않는다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    saveAnswers(답);
    stopSync();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).not.toHaveBeenCalled();
  });

  it("탈퇴 직전에 올리던 PUT 은 끝나기를 기다리고, 그 뒤 바뀐 답은 다시 올리지 않는다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    let finishSave!: (r: { ok: true; updatedAt: string }) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    let finishDelete!: () => void;
    vi.mocked(deleteAccountRemote).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishDelete = resolve))
    );
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    saveAnswers({ ...답, housingType: null }); // 올리는 사이에 또 바뀜 → 보통이면 다시 예약

    const done = withdraw();
    await settle();
    expect(deleteAccountRemote).not.toHaveBeenCalled();
    finishSave({ ok: true, updatedAt: "2026-11-04T09:20:00.000Z" });
    await settle();
    expect(deleteAccountRemote).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000); // 탈퇴 요청이 아직 가는 중
    expect(save).toHaveBeenCalledTimes(1);
    finishDelete();
    await done;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("409 뒤에 서버 항목이 없으면(다른 기기에서 탈퇴) 다시 쓰지 않고 이 기기도 끝낸다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    save.mockResolvedValueOnce({ ok: false, conflict: true });
    load.mockResolvedValueOnce(null);
    saveAnswers(답);
    await retrySync();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
    expect(getSyncState().status).toBe("off");
  });

  it("로그아웃 뒤에 도착한 부팅 GET 은 지운 사본을 되살리지 않는다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    let finishLoad!: (v: ReturnType<typeof remoteItem>) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)));
    startSync();
    await logout();

    finishLoad(remoteItem({ answers: { values: 답, answeredKeys: [] } }, "2026-11-04T11:00:00.000Z"));
    await settle();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});

describe("검토 1차 — 로그아웃은 동의 버전과 무관하게 비운다", () => {
  const 옛동의 = (sub: string) =>
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ sub, version: "2025-01-01", at: "2025-01-01T00:00:00.000Z" }));

  it("동기화했던 사람은 동의 문구가 바뀐 뒤 로그아웃해도 답·체크리스트·perky.sync 가 모두 지워진다", async () => {
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:20:00.000Z" });
    saveAnswers(답);
    saveChecklist("iksan-newcomer-moving-cost-support", { eligibility: true, period: false, documents: false });
    await flushNow();
    stopSync();
    옛동의("sub-a"); // CONSENT_VERSION 이 오른 것과 같다 — 지금 문구에는 동의하지 않은 상태

    await logout();

    for (const key of ["perky.answers", "perky.answered", "housing-benefit:listing", "housing-benefit:profile", "perky.declared"]) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    expect(loadChecklist("iksan-newcomer-moving-cost-support")).toEqual({ eligibility: false, period: false, documents: false });
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(save).toHaveBeenCalledTimes(1); // 옛 동의로는 올리지 않는다
  });

  it("perky.sync 가 없어도 이 사람의 (옛) 동의 기록이 있으면 지운다", async () => {
    옛동의("sub-a");
    saveAnswers(답);
    await logout();
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
  });

  it("동의하지 않은 사람의 로그인 전 답은 남긴다", async () => {
    signInAs("sub-b", { consent: false });
    window.localStorage.removeItem(CONSENT_KEY);
    saveAnswers(답);
    expect(await logout()).toEqual({ discardedUnsynced: false });
    expect(loadAnswers()).toEqual(답);
  });

  it("올리지 못하면 그래도 지우고 discardedUnsynced 로 알린다", async () => {
    await bootSynced();
    save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    saveAnswers(답);
    expect(await logout()).toEqual({ discardedUnsynced: true });
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
  });

  it("충돌로 멈춰 있으면 discardedUnsynced", async () => {
    await bootSynced();
    save.mockResolvedValueOnce({ ok: false, conflict: true });
    load.mockResolvedValueOnce(remoteItem({ declared: { singleHousehold: true } }, "2026-11-04T09:30:00.000Z"));
    saveAnswers(답);
    expect(await logout()).toEqual({ discardedUnsynced: true });
    expect(window.localStorage.getItem("perky.answers")).toBeNull();
  });

  it("다 올렸으면 discardedUnsynced 는 false", async () => {
    await bootSynced();
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:20:00.000Z" });
    saveAnswers(답);
    expect(await logout()).toEqual({ discardedUnsynced: false });
  });
});

describe("검토 1차 — 바뀐 것이 없으면 PUT 하지 않는다", () => {
  it("같은 답을 다시 적는 것만으로는 PUT 하지 않고 dirty 를 지운다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    saveAnsweredKeys([]); // /find 마운트가 하는 일 — 키는 새로 생기지만 묶음 내용은 같다
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).not.toHaveBeenCalled();
    expect(meta().dirty).toBe(false);
  });

  it("탭을 1.5초 안에 닫아 dirty 만 남았어도 다음 방문에 거짓 충돌을 띄우지 않고 서버 값을 받는다", async () => {
    await bootSynced();
    // 바뀐 것 없이 dirty 만 남은 채 탭을 닫았다
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...meta(), dirty: true }));
    resetSyncForTests();
    load.mockResolvedValueOnce(remoteItem({ answers: { values: 답, answeredKeys: [] } }, "2026-11-04T10:00:00.000Z"));

    startSync();
    await vi.waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    expect(save).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe("idle");
    expect(loadAnswers()).toEqual(답);
  });

  it("409 때 이 기기 답이 마지막으로 맞춘 그대로면 묻지 않고 서버 값을 받는다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    let finishSave!: (r: { ok: false; conflict: true }) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    load.mockResolvedValueOnce(remoteItem({ declared: { singleHousehold: true } }, "2026-11-04T09:30:00.000Z"));
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    window.localStorage.removeItem("perky.answers"); // 다른 탭이 되돌렸다 — 마지막으로 맞춘 값과 같아졌다
    finishSave({ ok: false, conflict: true });
    await settle();

    expect(getSyncState()).toMatchObject({ status: "idle", conflict: null });
    expect(window.localStorage.getItem("perky.declared")).not.toBeNull();
    expect(meta()).toMatchObject({ baseUpdatedAt: "2026-11-04T09:30:00.000Z", dirty: false });
  });
});

describe("검토 1차 — 두 탭", () => {
  it("탭 A 의 PUT 이 가는 사이 탭 B 가 고친 답은 dirty 로 남아 다시 올라간다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    let finishSave!: (r: { ok: true; updatedAt: string }) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    // 탭 B: 같은 localStorage 에 쓰고 자기 모듈에서 dirty 를 적는다 — 이 탭의 모듈은 모른다
    window.localStorage.setItem("perky.answers", JSON.stringify({ ...답, status: "재직" }));
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...meta(), dirty: true }));

    finishSave({ ok: true, updatedAt: "2026-11-04T09:05:00.000Z" });
    await settle();
    expect(meta()).toMatchObject({ baseUpdatedAt: "2026-11-04T09:05:00.000Z", dirty: true });

    save.mockResolvedValueOnce({ ok: true, updatedAt: "2026-11-04T09:06:00.000Z" });
    await flushNow();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].answers.values.status).toBe("재직");
    expect(save.mock.calls[1][1]).toBe("2026-11-04T09:05:00.000Z");
  });

  it("다른 탭이 먼저 올려 409 가 나면(서버 시각이 이 기기 메타와 같음) 묻지 않고 새 기준으로 다시 올린다", async () => {
    vi.useFakeTimers();
    await bootSynced();
    let finishSave!: (r: { ok: false; conflict: true }) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    saveAnswers(답);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    // 탭 B 가 같은 기준으로 먼저 올려 성공했다
    const B시각 = "2026-11-04T09:04:00.000Z";
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...meta(), baseUpdatedAt: B시각, dirty: true }));
    load.mockResolvedValueOnce(remoteItem({}, B시각));
    save.mockResolvedValueOnce({ ok: true, updatedAt: "2026-11-04T09:05:00.000Z" });

    finishSave({ ok: false, conflict: true });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][1]).toBe(B시각);
    await vi.waitFor(() => expect(getSyncState().status).toBe("idle"));
  });
});

describe("검토 1차 — 늦게 온 응답", () => {
  it("initialSync 의 GET 이 로그아웃 뒤에 와도 사본을 채우지 않는다", async () => {
    let finishLoad!: (v: ReturnType<typeof remoteItem>) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)));
    const pending = initialSync();
    await logout();
    finishLoad(remoteItem({ answers: { values: 답, answeredKeys: [] } }));
    await expect(pending).rejects.toThrow();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
  });

  it("부팅 GET 이 가는 사이 고친 답을 서버 값으로 덮어쓰지 않는다", async () => {
    seedSyncMeta("sub-a", { baseUpdatedAt: T0 });
    let finishLoad!: (v: ReturnType<typeof remoteItem>) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)));
    startSync();
    saveAnswers(답);
    finishLoad(remoteItem({ declared: { singleHousehold: true } }, "2026-11-04T11:00:00.000Z"));
    await settle();
    expect(loadAnswers()).toEqual(답);
    expect(reloadPage).not.toHaveBeenCalled();
  });
});

