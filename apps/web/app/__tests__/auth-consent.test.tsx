// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import ConsentPage from "@/app/auth/consent/page";
import { AUTH_KEY, CONSENT_KEY, RETURN_KEY, hasConsent, resetAuthForTests } from "@/lib/auth";
import { goTo, replacePage } from "@/lib/redirect";
import { loadRemote, saveRemote } from "@/lib/remote";
import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "@/lib/storage";
import { SYNC_META_KEY, resetSyncForTests } from "@/lib/sync";
import { TEST_LOGOUT_URL, enableLogin, remoteItem, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";

const 답 = {
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const load = vi.mocked(loadRemote);
const save = vi.mocked(saveRemote);

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  load.mockReset();
  save.mockReset();
  vi.mocked(goTo).mockReset();
  vi.mocked(replacePage).mockReset();
  enableLogin();
  signInAs("sub-a", { consent: false });
  saveAnswers(답);
  window.sessionStorage.setItem(RETURN_KEY, "/find/policies");
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

describe("/auth/consent (설계 '화면' 3)", () => {
  it("저장 항목(민감 항목 명시)·목적·보관 기간·저장 위치·카카오 회원번호·삭제 방법을 보여준다", async () => {
    render(<ConsentPage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("답을 저장해 둘까요?");
    const text = document.body.textContent ?? "";
    for (const phrase of [
      "민감 정보",
      "소득",
      "재산",
      "기초생활수급",
      "다른 기기에서 이어 보기",
      "마지막 저장 후 1년",
      "AWS 서울 리전",
      "카카오 회원번호",
      "회원 탈퇴",
    ]) {
      expect(text).toContain(phrase);
    }
    expect(screen.getByRole("link", { name: /개인정보 처리방침/ }).getAttribute("href")).toBe("/privacy");
  });

  it("동의 전에는 서버로 아무것도 보내지 않는다", async () => {
    render(<ConsentPage />);
    await screen.findByRole("button", { name: "동의하고 저장" });
    expect(load).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("동의하지 않으면 즉시 로그아웃 — 로그인 전에 고른 답은 그대로 둔다", async () => {
    render(<ConsentPage />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "동의하지 않음" }));

    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
    expect(loadAnswers()).toEqual(답);
    expect(hasConsent("sub-a")).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("예전 문구에 동의해 서버와 맞췄던 사람이 새 문구를 거절하면 — 이 기기의 사본(서버에서 온 답)을 지운다", async () => {
    // 이 사본은 서버와 맞춘 답이다. 공용 PC 에 남기면 안 된다 — sync logout() 과 같은 규칙.
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ sub: "sub-a", version: "2026-01-01", at: "2026-01-01T09:00:00.000Z" })
    );
    seedSyncMeta("sub-a");
    render(<ConsentPage />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "동의하지 않음" }));

    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(goTo).toHaveBeenCalledWith(TEST_LOGOUT_URL);
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
    expect(window.localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("동의하면 기록하고, 서버 항목이 없으면 이 기기 답을 올린 뒤 돌아간다", async () => {
    load.mockResolvedValue(null);
    save.mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:00:00.000Z" });
    render(<ConsentPage />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "동의하고 저장" }));

    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/find/policies"));
    expect(hasConsent("sub-a")).toBe(true);
    const [payload, base] = save.mock.calls[0];
    expect(base).toBeNull();
    expect(payload.answers.values).toEqual(답);
    expect(payload.consentVersion).toBe("2026-11-04");
  });

  it("서버에 다른 답이 있으면 무엇을 쓸지 묻는다", async () => {
    load.mockResolvedValue(remoteItem({ answers: { values: { ...답, status: "재직" }, answeredKeys: [] } }));
    render(<ConsentPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "동의하고 저장" }));

    const sheet = await screen.findByRole("dialog", { name: "이 기기의 답과 저장된 답 중 무엇을 쓸까요?" });
    expect(replacePage).not.toHaveBeenCalled();
    await user.click(within(sheet).getByRole("button", { name: "저장된 답" }));
    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/find/policies"));
    expect(loadAnswers().status).toBe("재직");
  });

  it("로그인 기록이 없으면 안내만 한다", async () => {
    window.localStorage.removeItem(AUTH_KEY);
    render(<ConsentPage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("로그인 정보가 없어요");
    expect(screen.queryByRole("button", { name: "동의하고 저장" })).toBeNull();
  });
});
