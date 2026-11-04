// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import { TopBar } from "@/app/components";
import { resetAuthForTests } from "@/lib/auth";
import { reloadPage } from "@/lib/redirect";
import { loadRemote, saveRemote } from "@/lib/remote";
import { loadAnswers, saveAnswers } from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import { enableLogin, remoteItem, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";

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
  vi.mocked(reloadPage).mockReset();
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

describe("상단바 오른쪽 자리 (설계 '화면' 4)", () => {
  it("로그인을 쓸 수 없으면 지금처럼 비어 있다 — 예전 로그인 기록이 있어도, 서버도 부르지 않는다", () => {
    signInAs();
    render(<TopBar backHref="/find" />);
    expect(screen.queryByRole("link", { name: /내 계정/ })).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("로그인 전에는 비어 있다", () => {
    enableLogin();
    render(<TopBar />);
    expect(screen.queryByRole("link", { name: /내 계정/ })).toBeNull();
  });

  it("로그인하면 사람 아이콘이 /account 로 간다", async () => {
    enableLogin();
    signInAs();
    seedSyncMeta();
    load.mockResolvedValue(remoteItem());
    render(<TopBar />);
    const link = await screen.findByRole("link", { name: "내 계정" });
    expect(link.getAttribute("href")).toBe("/account");
  });

  it("저장에 실패하면 '저장 안 됨 · 다시 시도', 누르면 다시 시도한다", async () => {
    enableLogin();
    signInAs();
    seedSyncMeta();
    load.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(remoteItem());
    render(<TopBar />);

    const retry = await screen.findByRole("button", { name: "저장 안 됨 · 다시 시도" });
    expect(screen.getByRole("link", { name: "내 계정 (저장 안 됨)" })).toBeTruthy();
    await userEvent.setup().click(retry);

    await waitFor(() => expect(screen.queryByRole("button", { name: "저장 안 됨 · 다시 시도" })).toBeNull());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("409 충돌이면 시트로 묻고, '저장된 답'을 고르면 사본을 바꿔 다시 연다", async () => {
    enableLogin();
    signInAs();
    seedSyncMeta("sub-a", { dirty: true });
    saveAnswers(답);
    save.mockResolvedValueOnce({ ok: false, conflict: true });
    load.mockResolvedValueOnce(
      remoteItem({ answers: { values: { ...답, region: "서울특별시 중구" }, answeredKeys: [] } }, "2026-11-04T09:30:00.000Z")
    );
    render(<TopBar />);

    const sheet = await screen.findByRole("dialog", { name: "이 기기의 답과 저장된 답 중 무엇을 쓸까요?" });
    await userEvent.setup().click(within(sheet).getByRole("button", { name: "저장된 답" }));

    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    expect(loadAnswers().region).toBe("서울특별시 중구");
  });
});
