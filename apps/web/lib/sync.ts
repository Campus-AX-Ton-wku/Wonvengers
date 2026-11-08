import { useSyncExternalStore } from "react";
import {
  consentAtFor,
  forgetConsent,
  hasAnyConsentRecord,
  hasConsent,
  isLoginAvailable,
  signOut,
  storedSub,
} from "./auth";
import { reloadPage } from "./redirect";
import { deleteAccountRemote, loadRemote, saveRemote } from "./remote";
import { clearLocalContent, onLocalChange, readLocalContent, writeLocalContent } from "./storage";
import {
  CONSENT_VERSION,
  SCHEMA_VERSION,
  contentFingerprint,
  isEmptyContent,
  sameContent,
  type GetResponseBody,
  type UserDataContent,
  type UserDataPayload,
} from "./user-data";

/**
 * 원격 동기화 (docs/기획/2026-11-04-카카오-로그인-설계.md "동기화 규칙").
 *
 * 켜지는 조건은 셋 다: 로그인을 쓸 수 있음(환경변수) · 이 기기에 로그인 기록 · 그 사람의 지금 문구 동의.
 * 하나라도 아니면 storage 의 알림을 듣지도 않는다 — 서버 호출이 생길 길이 없다.
 *
 * 켜진 뒤에는 서버가 기준이고 localStorage 는 화면을 빨리 그리기 위한 사본이다. 쓰기는 1.5초 모아
 * PUT 하고(baseUpdatedAt 으로 409), 실패하면 사본과 "올리지 못함" 표시(perky.sync 의 dirty)를 남겨
 * 다음 성공 때 함께 올린다 — PUT 이 통째 저장이라 마지막 한 번이면 된다.
 */

export const SAVE_DEBOUNCE_MS = 1500;
/**
 * { sub, baseUpdatedAt, lastSavedAt, dirty, syncedHash } — 이 기기가 마지막으로 본 서버 시각, 올리지 못한 변경 여부,
 * 마지막으로 서버와 맞춘 답 묶음의 지문. 같은 출처의 탭들이 함께 쓴다.
 */
export const SYNC_META_KEY = "perky.sync";

export type SyncStatus = "off" | "idle" | "saving" | "error" | "conflict";

export interface SyncState {
  status: SyncStatus;
  lastSavedAt: string | null;
  /** status 가 conflict 일 때 서버 쪽 값. 충돌 시트가 이것과 이 기기의 사본 중 하나를 고르게 한다. */
  conflict: GetResponseBody | null;
}

const OFF: SyncState = { status: "off", lastSavedAt: null, conflict: null };

interface SyncMeta {
  sub: string;
  baseUpdatedAt: string | null;
  lastSavedAt: string | null;
  dirty: boolean;
  /**
   * 마지막으로 서버와 같다고 확인한 답 묶음의 contentFingerprint. 모르면(옛 메타) null.
   * dirty 여도 지금 사본의 지문이 이것과 같으면 바뀐 것이 없다 — PUT 하지 않는다.
   * 탭마다 따로인 카운터 대신 이것으로 "올리는 사이 (다른 탭에서라도) 바뀌었나"를 본다.
   */
  syncedHash: string | null;
}

let state: SyncState = OFF;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeLocal: (() => void) | null = null;
let booted = false;
let inflight: Promise<void> | null = null;
/** 올리는 사이에 또 바뀌었는지 알려고 센다. */
let changeSeq = 0;
/** stopSync 마다 오른다. 멈추기 전에 시작한 서버 읽기의 늦은 결과를 버린다(로그아웃·탈퇴 뒤 사본을 되살리지 않게). */
let epoch = 0;
/** 탈퇴 요청이 가는 동안 참. 이때는 어떤 PUT 도 내보내지 않는다 — 지운 자리에 항목이 다시 생긴다. */
let withdrawing = false;

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, () => OFF);
}

export function syncEnabled(): boolean {
  if (!isLoginAvailable()) return false;
  const sub = storedSub();
  return sub !== null && hasConsent(sub);
}

function readMeta(): SyncMeta | null {
  const sub = storedSub();
  if (sub === null) return null;
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as Partial<SyncMeta>;
    if (meta.sub !== sub) return null;
    return {
      sub,
      baseUpdatedAt: typeof meta.baseUpdatedAt === "string" ? meta.baseUpdatedAt : null,
      lastSavedAt: typeof meta.lastSavedAt === "string" ? meta.lastSavedAt : null,
      dirty: meta.dirty === true,
      syncedHash: typeof meta.syncedHash === "string" ? meta.syncedHash : null,
    };
  } catch {
    return null;
  }
}

function writeMeta(meta: SyncMeta): void {
  try {
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // 못 적으면 다음 방문에 처음 로그인처럼 다시 맞춘다.
  }
}

/** 누구 것이든 perky.sync 가 있는가 — 이 기기에 서버와 맞춘 답이 있었다는 뜻이다. */
function hasAnyMeta(): boolean {
  try {
    return window.localStorage.getItem(SYNC_META_KEY) !== null;
  } catch {
    return false;
  }
}

function anyMetaDirty(): boolean {
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY);
    return raw !== null && (JSON.parse(raw) as Partial<SyncMeta>).dirty === true;
  } catch {
    return false;
  }
}

function removeMeta(): void {
  try {
    window.localStorage.removeItem(SYNC_META_KEY);
  } catch {
    // 무시
  }
}

function payloadFor(sub: string, content: UserDataContent): UserDataPayload {
  return {
    ...content,
    schemaVersion: SCHEMA_VERSION,
    consentVersion: CONSENT_VERSION,
    consentAt: consentAtFor(sub) ?? new Date().toISOString(),
  };
}

function markDirty(): void {
  const sub = storedSub();
  if (sub === null) return;
  changeSeq++;
  const meta = readMeta() ?? { sub, baseUpdatedAt: null, lastSavedAt: null, dirty: false, syncedHash: null };
  writeMeta({ ...meta, dirty: true });
}

const localFingerprint = () => contentFingerprint(readLocalContent());

/**
 * dirty 지만 사본이 마지막으로 맞춘 그대로면 dirty 를 내린다. 같은 값을 다시 적기만 하고 1.5초 안에 탭을
 * 닫으면 dirty 만 남는다 — 그대로 올리면 옛 기준 시각으로 409 가 나서, 고친 적 없는 답으로 충돌을 묻게 된다.
 */
function settleNoopDirty(meta: SyncMeta): SyncMeta {
  if (!meta.dirty || meta.syncedHash === null || meta.syncedHash !== localFingerprint()) return meta;
  const next = { ...meta, dirty: false };
  writeMeta(next);
  return next;
}

function schedule(): void {
  // 멈춘 뒤(로그아웃·탈퇴)에 끝난 PUT 이 다음 PUT 을 예약하지 않게, 듣고 있을 때만.
  if (unsubscribeLocal === null || withdrawing) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushNow();
  }, SAVE_DEBOUNCE_MS);
}

const handleOnline = () => {
  void retrySync();
};

/** 상단바(AccountSlot)가 그려질 때 부른다. 여러 번 불러도 한 번만 붙고, 페이지마다 서버 값을 한 번 본다. */
export function startSync(): void {
  if (typeof window === "undefined") return;
  if (!syncEnabled()) {
    if (state.status !== "off") setState(OFF);
    return;
  }
  if (unsubscribeLocal === null) {
    unsubscribeLocal = onLocalChange(({ immediate }) => {
      markDirty();
      if (immediate) void flushNow();
      else schedule();
    });
    window.addEventListener("online", handleOnline);
  }
  if (state.status === "off") setState({ status: "idle", lastSavedAt: readMeta()?.lastSavedAt ?? null, conflict: null });
  if (!booted) {
    booted = true;
    void refreshFromServer();
  }
}

export function stopSync(): void {
  unsubscribeLocal?.();
  unsubscribeLocal = null;
  if (typeof window !== "undefined") window.removeEventListener("online", handleOnline);
  if (timer !== null) clearTimeout(timer);
  timer = null;
  booted = false;
  epoch++;
  setState(OFF);
}

/** 모아 둔 쓰기를 지금 올린다. 던지지 않는다 — 결과는 상태(idle·error·conflict)로 남는다. */
export async function flushNow(): Promise<void> {
  if (!syncEnabled()) return;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  while (inflight) await inflight;
  if (withdrawing || !syncEnabled()) return;
  const stored = readMeta();
  if (stored === null || !stored.dirty) return;
  const meta = settleNoopDirty(stored);
  if (!meta.dirty) {
    if (state.status === "error") setState({ status: "idle" });
    return;
  }
  let again = false;
  const run = (async () => {
    setState({ status: "saving" });
    try {
      const content = readLocalContent();
      const sentHash = contentFingerprint(content);
      const result = await saveRemote(payloadFor(meta.sub, content), meta.baseUpdatedAt);
      if (result.ok) {
        // 같은 localStorage 를 쓰는 다른 탭이 그 사이 고쳤을 수 있다 — 이 탭의 카운터로는 모른다. 내용으로 본다.
        const stillDirty = localFingerprint() !== sentHash;
        writeMeta({
          sub: meta.sub,
          baseUpdatedAt: result.updatedAt,
          lastSavedAt: result.updatedAt,
          dirty: stillDirty,
          syncedHash: sentHash,
        });
        setState({ status: "idle", lastSavedAt: result.updatedAt });
        if (stillDirty) schedule();
        return;
      }
      const remote = await loadRemote();
      if (remote === null) {
        // 409 뒤에 항목이 없다 = 그 사이 (다른 기기에서) 탈퇴했다. 다시 쓰면 지운 자리에 항목이 되살아난다 —
        // 아직 유효한 access 토큰이 남아 있어도. 페이지를 다시 열 때와 같이 이 기기도 끝낸다.
        endLocalSession();
        return;
      }
      const fresh = readMeta();
      if (fresh !== null && fresh.baseUpdatedAt === remote.updatedAt && fresh.baseUpdatedAt !== meta.baseUpdatedAt) {
        // 이 기기의 다른 탭이 먼저 올렸다. 사본(localStorage)은 탭끼리 같으니 새 기준 시각으로 다시 올리면 된다.
        writeMeta({ ...fresh, dirty: true });
        setState({ status: "idle" });
        again = true;
        return;
      }
      if (meta.syncedHash !== null && localFingerprint() === meta.syncedHash) {
        // 이 기기 답은 마지막으로 맞춘 그대로다 — 물을 것이 없다. 서버 값을 받는다.
        const changed = !sameContent(readLocalContent(), remote.data);
        applyRemote(remote);
        if (changed) reloadPage();
        return;
      }
      setState({ status: "conflict", conflict: remote });
    } catch {
      setState({ status: "error" });
    }
  })();
  inflight = run;
  try {
    await run;
  } finally {
    if (inflight === run) inflight = null;
  }
  if (again) await flushNow();
}

/** "다시 시도" 버튼과 online 이벤트. 올리지 못한 것이 있으면 올리고, 없으면 서버 값을 다시 본다. */
export async function retrySync(): Promise<void> {
  if (!syncEnabled()) return;
  const meta = readMeta();
  if (meta !== null && meta.dirty) return flushNow();
  return refreshFromServer();
}

function applyRemote(remote: GetResponseBody): void {
  const sub = storedSub();
  if (sub === null) return;
  writeLocalContent(remote.data);
  writeMeta({
    sub,
    baseUpdatedAt: remote.updatedAt,
    lastSavedAt: remote.updatedAt,
    dirty: false,
    syncedHash: contentFingerprint(remote.data),
  });
  setState({ status: "idle", lastSavedAt: remote.updatedAt, conflict: null });
}

/** 다른 기기에서 탈퇴했다. 이 기기에서도 로그인과 사본을 지운다. */
function endLocalSession(): void {
  stopSync();
  clearLocalContent();
  removeMeta();
  signOut({ redirect: false });
}

async function refreshFromServer(): Promise<void> {
  if (!syncEnabled()) return;
  const startedAt = epoch;
  const stored = readMeta();
  if (stored === null) {
    // 이 기기는 아직 서버와 맞춘 적이 없다(동의 직후 실패했거나 충돌을 고르지 않고 떠났다).
    try {
      await initialSync();
    } catch {
      if (startedAt === epoch) setState({ status: "error" });
    }
    return;
  }
  const meta = settleNoopDirty(stored);
  if (meta.dirty) return flushNow();
  const seqAtStart = changeSeq;
  try {
    const remote = await loadRemote();
    if (startedAt !== epoch || withdrawing) return;
    if (remote === null) {
      if (meta.baseUpdatedAt !== null) {
        endLocalSession();
        return;
      }
      markDirty();
      return flushNow();
    }
    if (changeSeq !== seqAtStart) {
      // GET 이 가는 사이 이 기기에서 고쳤다. 덮어쓰지 않는다 — 곧 나갈 PUT 이 옛 기준 시각으로 409 를 받아 가린다.
      return;
    }
    if (remote.updatedAt === meta.baseUpdatedAt) {
      const fresh = readMeta();
      if (fresh !== null && fresh.baseUpdatedAt === remote.updatedAt && fresh.syncedHash === null) {
        writeMeta({ ...fresh, syncedHash: contentFingerprint(remote.data) });
      }
      setState({ status: "idle", conflict: null });
      return;
    }
    const changed = !sameContent(readLocalContent(), remote.data);
    applyRemote(remote);
    // 화면들은 마운트 때 사본을 한 번 읽는다. 바뀐 값을 보이려면 다시 열어야 한다.
    if (changed) reloadPage();
  } catch {
    if (startedAt === epoch) setState({ status: "error" });
  }
}

export type InitialSyncResult = "uploaded" | "downloaded" | "conflict";

/**
 * 동의한 직후(또는 동의한 기기에서 다시 로그인한 직후) 한 번. 설계의 세 갈래:
 * 서버 항목 없음 → 이 기기 답을 올린다 · 둘 다 있고 다름 → 묻는다 · 그 밖 → 서버 값을 내려받는다.
 * 묻는 동안에는 메타를 적지 않는다 — 고르지 않고 떠나면 다음 방문에 다시 묻는다.
 */
export async function initialSync(): Promise<InitialSyncResult> {
  const sub = storedSub();
  if (!syncEnabled() || sub === null) throw new Error("sync is not enabled");
  const startedAt = epoch;
  const remote = await loadRemote();
  // 기다리는 사이 로그아웃·탈퇴했으면 늦게 온 값으로 사본을 채우지 않는다.
  if (startedAt !== epoch || withdrawing || storedSub() !== sub) throw new Error("sync stopped");
  const local = readLocalContent();
  if (remote === null) {
    changeSeq++;
    writeMeta({ sub, baseUpdatedAt: null, lastSavedAt: null, dirty: true, syncedHash: null });
    await flushNow();
    return getSyncState().status === "conflict" ? "conflict" : "uploaded";
  }
  if (!isEmptyContent(local) && !sameContent(local, remote.data)) {
    setState({ status: "conflict", conflict: remote });
    return "conflict";
  }
  applyRemote(remote);
  return "downloaded";
}

export async function resolveConflict(choice: "local" | "remote"): Promise<void> {
  const remote = state.conflict;
  const sub = storedSub();
  if (remote === null || sub === null) return;
  if (choice === "remote") {
    applyRemote(remote);
    return;
  }
  changeSeq++;
  writeMeta({
    sub,
    baseUpdatedAt: remote.updatedAt,
    lastSavedAt: state.lastSavedAt,
    dirty: true,
    syncedHash: contentFingerprint(remote.data),
  });
  setState({ status: "idle", conflict: null });
  await flushNow();
}

/**
 * 지금 로그아웃하면 잃을 변경이 있는가 — 올리지 못한 변경(dirty)이나 고르지 않은 충돌.
 * 계정 화면이 로그아웃 전에 묻는다. logout() 의 discardedUnsynced 와 같은 기준이다
 * (logout 은 Cognito 로 떠나므로 그 결과를 화면에 보일 틈이 없다).
 */
export function hasUnsyncedChanges(): boolean {
  if (typeof window === "undefined") return false;
  return state.status === "conflict" || anyMetaDirty();
}

export interface LogoutResult {
  /** 올리지 못한(또는 충돌로 멈춘) 변경을 지운 채 로그아웃했다. 계정 화면은 그 전에 hasUnsyncedChanges 로 묻는다. */
  discardedUnsynced: boolean;
}

/**
 * 로그아웃. 지금 문구에 동의한 상태면 남은 쓰기를 올려 본다(요청마다 REMOTE_TIMEOUT_MS 상한 — 실패·충돌이어도
 * 로그아웃은 한다). 그다음, 이 기기가 서버와 맞춘 적이 있거나(perky.sync) 이 사람이 동의한 적이 있으면
 * (버전 무관 — 문구가 바뀌어 지금은 동기화가 꺼져 있어도 사본은 서버에서 온 답이다) 이 기기의 사본을 지운다(공용 PC).
 * 동의 화면의 [동의하지 않음]도 이 함수를 쓴다 — 서버에 간 적 없는 로그인 전 답(메타도 동의 기록도 없음)은 남고,
 * 예전 문구에 동의해 서버와 맞췄던 사람이 새 문구를 거절하면 서버에서 온 사본은 지운다.
 */
export async function logout(): Promise<LogoutResult> {
  const sub = storedSub();
  const clear = hasAnyMeta() || (sub !== null && hasAnyConsentRecord(sub));
  let discardedUnsynced = false;
  try {
    if (syncEnabled()) await flushNow();
  } finally {
    if (clear) discardedUnsynced = state.status === "conflict" || anyMetaDirty();
    stopSync();
    if (clear) {
      clearLocalContent();
      removeMeta();
    }
    signOut();
  }
  return { discardedUnsynced };
}

/**
 * 회원 탈퇴. 먼저 동기화를 멈춘다 — 탈퇴 요청 뒤에 모아 둔 PUT 이 나가면 지운 자리에 항목이 다시 생긴다.
 * 서버가 실패하면 아무것도 지우지 않고 동기화를 다시 켠 뒤 던진다.
 */
export async function withdraw(): Promise<void> {
  withdrawing = true;
  try {
    stopSync();
    while (inflight) await inflight;
    try {
      await deleteAccountRemote();
    } catch (err) {
      withdrawing = false;
      startSync();
      throw err;
    }
    clearLocalContent();
    removeMeta();
    forgetConsent();
    signOut({ redirect: false });
  } finally {
    withdrawing = false;
  }
}

/** 테스트 전용. */
export function resetSyncForTests(): void {
  stopSync();
  inflight = null;
  changeSeq = 0;
  withdrawing = false;
  listeners.clear();
  state = OFF;
}
