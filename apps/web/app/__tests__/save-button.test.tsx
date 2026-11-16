// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(),
}));

import { SaveButton } from "@/app/components";
import { resetAuthForTests, signIn } from "@/lib/auth";
import { loadSaved } from "@/lib/storage";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(signIn).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("♡ 찜 버튼", () => {
  it("로그인을 쓸 수 없는 빌드에서는 그리지 않는다", () => {
    render(<SaveButton policyId="a" policyName="청년월세" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("로그인 안 했으면 로그인 시트 — 찜하지 않고, 로그인 뒤 이 화면으로", async () => {
    enableLogin();
    window.history.replaceState(null, "", "/find/policies/a");
    render(<SaveButton policyId="a" policyName="청년월세" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "청년월세 찜하기" }));
    expect(screen.getByRole("dialog", { name: "로그인하고 찜해 둘까요?" })).toBeTruthy();
    expect(loadSaved()).toEqual([]);
    await userEvent.setup().click(screen.getByRole("button", { name: "카카오로 계속하기" }));
    expect(signIn).toHaveBeenCalledWith("/find/policies/a");
  });

  it("로그인했으면 누를 때마다 찜 ↔ 해제, aria-pressed 로 상태를 말한다", async () => {
    enableLogin();
    signInAs("sub-a");
    render(<SaveButton policyId="a" policyName="청년월세" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "청년월세 찜하기" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await user.click(button);
    expect(loadSaved()).toEqual(["a"]);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await user.click(button);
    expect(loadSaved()).toEqual([]);
  });

  it("카드 안에 있어도 카드 이동을 막는다(이벤트 전파 차단)", async () => {
    enableLogin();
    signInAs("sub-a");
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <SaveButton policyId="a" policyName="청년월세" />
      </div>
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "청년월세 찜하기" }));
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
