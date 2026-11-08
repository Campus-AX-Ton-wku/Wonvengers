// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthForTests } from "@/lib/auth";
import { flushNow, getSyncState, resetSyncForTests, retrySync, startSync } from "@/lib/sync";
import { resetAllAnswers, saveAnswers, saveChecklist, saveDeclared, saveListing } from "@/lib/storage";
import { enableLogin, seedSyncMeta, signInAs } from "./auth-fixtures";

/**
 * "로그인 전·동의 전에는 서버 호출 0번" (설계 "동기화 규칙"·"테스트").
 * 여기서는 lib/remote 와 oidc-client-ts 를 대역으로 바꾸지 않는다 — 진짜 코드가 fetch 를
 * 한 번이라도 부르면 이 테스트가 잡는다.
 */
const fetchSpy = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  resetSyncForTests();
  resetAuthForTests();
});

afterEach(() => {
  resetSyncForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function 이것저것() {
  vi.useFakeTimers();
  startSync();
  saveAnswers({ birthDate: "2002-03-14", region: "서울특별시 중구", status: "재직", incomeBracket: 3, housingType: "월세" });
  saveListing({
    region: "서울특별시 중구",
    contractType: "월세",
    deposit: 1,
    rentOrYearlyAmount: 1,
    managementFee: 0,
    oneTimeMoveCost: 0,
    contractStartDate: "",
    months: 12,
    confirmedMatchesActualContract: false,
  });
  saveDeclared("singleHousehold", true);
  saveChecklist("iksan-newcomer-moving-cost-support", { eligibility: true, period: false, documents: false });
  resetAllAnswers();
  await flushNow();
  await retrySync();
  await vi.advanceTimersByTimeAsync(60_000);
}

describe("서버 호출 0번", () => {
  it("로그인 전", async () => {
    enableLogin();
    await 이것저것();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe("off");
  });

  it("로그인했어도 동의 전 — 토큰 갱신도 하지 않는다", async () => {
    enableLogin();
    signInAs("sub-a", { consent: false });
    seedSyncMeta("sub-a", { dirty: true });
    await 이것저것();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("다른 사람의 동의 기록으로는 켜지지 않는다", async () => {
    enableLogin();
    signInAs("sub-a");
    signInAs("sub-b", { consent: false });
    await 이것저것();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("로그인을 쓸 수 없으면(환경변수 없음) 예전 로그인·동의 기록이 있어도", async () => {
    signInAs("sub-a");
    seedSyncMeta("sub-a", { dirty: true });
    await 이것저것();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("대조군 — 막는 것이 테스트 대역 때문이 아님을 보인다", () => {
  it("로그인 + 동의면 그때부터 부른다(먼저 Cognito 토큰 갱신)", async () => {
    enableLogin();
    signInAs("sub-a");
    seedSyncMeta("sub-a");
    startSync();
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://perky-test.auth.ap-northeast-2.amazoncognito.com/oauth2/token"
    );
  });
});
