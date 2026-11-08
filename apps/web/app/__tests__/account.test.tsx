// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(),
}));
vi.mock("@/lib/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync")>()),
  logout: vi.fn(),
  withdraw: vi.fn(),
}));

import AccountPage from "@/app/account/page";
import { resetAuthForTests, signIn } from "@/lib/auth";
import { loadRemote, saveRemote } from "@/lib/remote";
import { logout, resetSyncForTests, withdraw } from "@/lib/sync";
import { enableLogin, remoteItem, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  vi.mocked(loadRemote).mockReset();
  vi.mocked(saveRemote).mockReset();
  vi.mocked(logout).mockReset();
  vi.mocked(withdraw).mockReset();
  vi.mocked(signIn).mockReset();
  enableLogin();
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

function 로그인한채로() {
  signInAs();
  seedSyncMeta();
  vi.mocked(loadRemote).mockResolvedValue(remoteItem());
  render(<AccountPage />);
}

async function 탈퇴창열기(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "회원 탈퇴" }));
  return screen.getByRole("dialog", { name: "회원 탈퇴할까요?" });
}

describe("/account (설계 '화면' 5)", () => {
  it("로그인 상태, 마지막 저장 시각, 로그아웃·회원 탈퇴, 처리방침 링크", async () => {
    로그인한채로();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("내 계정");
    expect(screen.getByText("카카오로 로그인했어요")).toBeTruthy();
    expect(screen.getByText(/^마지막 저장 \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "개인정보 처리방침" }).getAttribute("href")).toBe("/privacy");
  });

  it("로그아웃을 누르면 로그아웃한다", async () => {
    로그인한채로();
    await userEvent.setup().click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("올리지 못한 변경이 있으면 로그아웃 전에 알린다 — 취소하면 그대로, '그래도 로그아웃'이면 로그아웃", async () => {
    signInAs();
    seedSyncMeta("sub-a", { dirty: true });
    vi.mocked(loadRemote).mockResolvedValue(remoteItem());
    vi.mocked(saveRemote).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AccountPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "로그아웃" }));
    const dialog = await screen.findByRole("dialog", { name: "저장 안 된 변경이 있어요" });
    expect(dialog.textContent).toContain("로그아웃하면 이 기기에서 저장하지 못한 변경이 사라져요.");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "취소" }));
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "저장 안 된 변경이 있어요" })).getByRole("button", {
        name: "그래도 로그아웃",
      })
    );
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("탈퇴 확인 — 취소하면 그대로, '탈퇴하기'를 누르면 지우고 안내한다", async () => {
    vi.mocked(withdraw).mockResolvedValue(undefined);
    로그인한채로();
    const user = userEvent.setup();

    const dialog = await 탈퇴창열기(user);
    // 되돌릴 수 없는 확인은 안전한 쪽에 먼저 포커스 — 열자마자 Enter 한 번에 지워지지 않게.
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "취소" }));
    expect(dialog.textContent).toContain("저장된 답과 회원 정보가 모두 지워지고 되돌릴 수 없어요.");
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(withdraw).not.toHaveBeenCalled();

    await user.click(within(await 탈퇴창열기(user)).getByRole("button", { name: "탈퇴하기" }));

    expect(withdraw).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole("heading", { level: 1, name: "탈퇴가 끝났어요" })).textContent).toBe("탈퇴가 끝났어요");
    expect(screen.getByText(/다시 카카오로 로그인하면 새 회원으로 시작해요/)).toBeTruthy();
  });

  it("탈퇴가 실패하면 알리고 아무것도 바꾸지 않는다", async () => {
    vi.mocked(withdraw).mockRejectedValue(new Error("500"));
    로그인한채로();
    const user = userEvent.setup();
    await user.click(within(await 탈퇴창열기(user)).getByRole("button", { name: "탈퇴하기" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "탈퇴하지 못했어요. 아무것도 지우지 않았으니 잠시 뒤 다시 시도해 주세요."
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("내 계정");
  });

  it("로그인하지 않았으면 카카오로 로그인할 수 있다", async () => {
    render(<AccountPage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("로그인하지 않았어요");
    const button = screen.getByRole("button", { name: "카카오로 계속하기" }) as HTMLButtonElement;
    vi.mocked(signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    await userEvent.setup().click(button);
    expect(signIn).toHaveBeenCalledWith("/account");
    expect((await screen.findByRole("alert")).textContent).toBe("지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요");
    expect(button.disabled).toBe(false);
  });

  it("카카오 버튼은 누르는 동안 막힌다", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));
    render(<AccountPage />);
    const user = userEvent.setup();
    const button = (await screen.findByRole("button", { name: "카카오로 계속하기" })) as HTMLButtonElement;
    await user.click(button);
    await user.click(button);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
  });
});
