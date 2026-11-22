// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "@/lib/auth";
import { resetSyncForTests, syncReady } from "@/lib/sync";
import { enableLogin, seedSyncMeta, signInAs } from "./auth-fixtures";

/** 배지 판정은 이 기기가 서버와 처음 맞춘 뒤에만 (내 프로필 설계 §7) */

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("syncReady", () => {
  it("로그인 · 동의 · 처음 동기화 기록이 모두 있어야 준비됨", () => {
    expect(syncReady()).toBe(false);
    enableLogin();
    signInAs("sub-a");
    expect(syncReady()).toBe(false);
    seedSyncMeta("sub-a");
    expect(syncReady()).toBe(true);
  });

  it("다른 계정의 동기화 기록은 준비가 아니다", () => {
    enableLogin();
    signInAs("sub-b");
    seedSyncMeta("sub-a");
    expect(syncReady()).toBe(false);
  });
});
