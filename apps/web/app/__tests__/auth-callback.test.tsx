// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  handleCallback: vi.fn(),
}));
vi.mock("@/lib/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync")>()),
  initialSync: vi.fn(),
  resolveConflict: vi.fn(),
}));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import AuthCallbackPage from "@/app/auth/callback/page";
import { RETURN_KEY, handleCallback } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { initialSync, resolveConflict } from "@/lib/sync";
import { enableLogin } from "@/lib/__tests__/auth-fixtures";
import { resetNavigation, routerMock } from "./navigation-mock";

beforeEach(() => {
  vi.mocked(handleCallback).mockReset();
  vi.mocked(initialSync).mockReset();
  vi.mocked(resolveConflict).mockReset();
  vi.mocked(replacePage).mockReset();
  resetNavigation("/auth/callback?code=c&state=s");
  window.sessionStorage.setItem(RETURN_KEY, "/find/policies");
  enableLogin();
});

describe("/auth/callback", () => {
  it("처음이면 /auth/consent 로 replace 하고, 서버와 맞추지 않는다", async () => {
    vi.mocked(handleCallback).mockResolvedValue({ sub: "sub-a", needsConsent: true });
    render(<AuthCallbackPage />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/auth/consent"));
    expect(handleCallback).toHaveBeenCalledWith("http://localhost:3000/auth/callback?code=c&state=s");
    expect(initialSync).not.toHaveBeenCalled();
  });

  it("이 기기에서 동의했던 사람이면 맞춘 뒤 로그인 전 화면으로", async () => {
    vi.mocked(handleCallback).mockResolvedValue({ sub: "sub-a", needsConsent: false });
    vi.mocked(initialSync).mockResolvedValue("downloaded");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/find/policies"));
  });

  it("맞추기가 실패해도 로그인은 됐으니 돌아간다 — 상단바가 다시 시도한다", async () => {
    vi.mocked(handleCallback).mockResolvedValue({ sub: "sub-a", needsConsent: false });
    vi.mocked(initialSync).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AuthCallbackPage />);
    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/find/policies"));
  });

  it("두 곳의 답이 다르면 묻고, 고른 뒤 돌아간다", async () => {
    vi.mocked(handleCallback).mockResolvedValue({ sub: "sub-a", needsConsent: false });
    vi.mocked(initialSync).mockResolvedValue("conflict");
    vi.mocked(resolveConflict).mockResolvedValue(undefined);
    render(<AuthCallbackPage />);

    const sheet = await screen.findByRole("dialog", { name: "이 기기의 답과 저장된 답 중 무엇을 쓸까요?" });
    expect(replacePage).not.toHaveBeenCalled();
    await userEvent.setup().click(within(sheet).getByRole("button", { name: "이 기기의 답" }));

    expect(resolveConflict).toHaveBeenCalledWith("local");
    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/find/policies"));
  });

  it("카카오에서 취소하면 로그인하지 못했다고 말하고 질문으로 돌아갈 길을 준다", async () => {
    vi.mocked(handleCallback).mockRejectedValue(new Error("access_denied"));
    render(<AuthCallbackPage />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("로그인하지 못했어요");
    expect(screen.getByRole("link", { name: "질문으로 돌아가기" }).getAttribute("href")).toBe("/find");
  });
});
