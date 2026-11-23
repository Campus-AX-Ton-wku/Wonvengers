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
import { RETURN_KEY, resetAuthForTests, signIn } from "@/lib/auth";
import { goTo } from "@/lib/redirect";
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
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("내 정보");
    expect(screen.getByText("카카오로 로그인했어요")).toBeTruthy();
    expect(screen.getByText(/^마지막 저장 \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "개인정보 처리방침" }).getAttribute("href")).toBe("/privacy");
  });

  it("'화면 모드'는 로그인했든 안 했든 보인다 — 이 기기 설정 (11/22 다크 모드)", async () => {
    로그인한채로();
    expect(await screen.findByRole("group", { name: "화면 모드" })).toBeTruthy();
  });

  it("로그인하지 않아도 '화면 모드'를 바꿀 수 있다", async () => {
    enableLogin();
    render(<AccountPage />);
    expect(await screen.findByText("로그인하지 않았어요")).toBeTruthy();
    expect(screen.getByRole("group", { name: "화면 모드" })).toBeTruthy();
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
    // 무엇을 잃는지 확인창 안에서 말한다 — 위험한 버튼 바로 위
    expect(within(dialog).getByText(/로그아웃하면 이 기기에서 저장하지 못한 변경이 사라져요/)).toBeTruthy();
    expect(dialog.textContent).toContain("인터넷 연결을 확인하고 '다시 시도'로 먼저 저장할 수 있어요.");
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
    expect(screen.getByText(/저장된 답과 회원 정보를 모두 지웠어요/)).toBeTruthy();
  });

  it("탈퇴가 실패하면 알리고 아무것도 바꾸지 않는다", async () => {
    vi.mocked(withdraw).mockRejectedValue(new Error("500"));
    로그인한채로();
    const user = userEvent.setup();
    await user.click(within(await 탈퇴창열기(user)).getByRole("button", { name: "탈퇴하기" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "탈퇴하지 못했어요. 아무것도 지우지 않았으니 잠시 뒤 다시 시도해 주세요."
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("내 정보");
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

describe("알림 설정 한 줄 (11/20 두 단계 구조)", () => {
  it("공개 키가 없는 빌드에서는 그리지 않는다", async () => {
    로그인한채로();
    await screen.findByRole("heading", { level: 1, name: "내 정보" });
    expect(screen.queryByRole("link", { name: /알림 설정/ })).toBeNull();
  });

  it("알림 칸 대신 '알림 설정' 한 줄 — 알림 설정 화면으로, 켜기 버튼은 여기 없다", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublicKeyForTests");
    로그인한채로();
    const link = await screen.findByRole("link", { name: /알림 설정/ });
    expect(link.getAttribute("href")).toBe("/notifications/settings");
    expect(screen.queryByRole("heading", { level: 2, name: "알림" })).toBeNull();
    expect(screen.queryByRole("button", { name: "알림 켜기" })).toBeNull();
  });
});



/**
 * 11/23 ggue 실기기: 로그인했는데 이 기기에 저장 동의가 없으면(동의 화면에서 고르지 않고 나감) 앱이 조용히 저장을 멈췄다 —
 * '아직 저장 전이에요'만 보이고 배지도 안 받아졌다(배지는 처음 동기화 뒤에만 판정). 동의로 가는 길을 보여 준다.
 */
describe("/account — 로그인했지만 이 기기에 저장 동의가 없을 때", () => {
  it("계정 줄에 동의 안내 + [동의하고 저장] → 돌아올 곳(/account)을 적고 동의 화면으로", async () => {
    const user = userEvent.setup();
    signInAs("sub-a", { consent: false });
    render(<AccountPage />);
    expect(await screen.findByText("이 기기에서는 아직 저장에 동의하지 않았어요")).toBeTruthy();
    expect(screen.queryByText("아직 저장 전이에요")).toBeNull();
    const buttons = screen.getAllByRole("button", { name: "동의하고 저장" });
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[0]);
    expect(window.sessionStorage.getItem(RETURN_KEY)).toBe("/account");
    expect(goTo).toHaveBeenCalledWith("/auth/consent");
  });

  it("배지 칸에 '저장에 동의하면 배지를 받을 수 있어요'", async () => {
    signInAs("sub-a", { consent: false });
    render(<AccountPage />);
    const badges = await screen.findByRole("region", { name: /배지/ });
    expect(within(badges).getByText("저장에 동의하면 배지를 받을 수 있어요")).toBeTruthy();
    expect(within(badges).queryByText("앱을 쓰다 보면 모여요")).toBeNull();
  });

  it("동의한 기기에서는 안내 · 버튼이 없다", async () => {
    로그인한채로();
    await screen.findByText("카카오로 로그인했어요");
    expect(screen.queryByText("이 기기에서는 아직 저장에 동의하지 않았어요")).toBeNull();
    expect(screen.queryByRole("button", { name: "동의하고 저장" })).toBeNull();
    expect(screen.getByText("앱을 쓰다 보면 모여요")).toBeTruthy();
  });
});
