// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import { ChecklistRow, SaveButton, Sheet } from "@/app/components";
import { BadgeWatcher } from "@/app/components/BadgeWatcher";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { saveRemote } from "@/lib/remote";
import { markBadgesSeen, markHomeReached, saveSavedList } from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import type { PolicyMeta } from "@/lib/types";
import { enableLogin, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";

/**
 * 작은 움직임 4곳 (11/23 ggue) — 아래서 올라오는 창 · 배지 받는 순간 · 하트 · 체크.
 * 움직임은 CSS 라 jsdom 이 돌리지 않는다 — 여기서는 '언제 클래스가 붙는지'와 '동작 줄이기에서 꺼지는지'를 본다.
 */

const POLICY = (policiesJson as PolicyMeta[])[0];

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
  vi.mocked(saveRemote).mockResolvedValue({ ok: true, updatedAt: "2026-11-23T09:00:00.000Z" });
});
afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

describe("1. 아래에서 올라오는 창", () => {
  it("배경은 어두워지며, 창은 아래에서 올라오며 나타난다", () => {
    render(
      <Sheet title="프로필 꾸미기" onClose={() => {}}>
        <button type="button">저장</button>
      </Sheet>
    );
    const dialog = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    expect(dialog.className).toContain("sheet-in");
    expect(dialog.parentElement!.className).toContain("sheet-backdrop");
  });
});

describe("2. 배지 받는 순간", () => {
  it("창 안 배지 그림이 자리를 잡으며 나타나고, 빛 고리가 한 번 퍼진다", async () => {
    enableLogin();
    signInAs("sub-a");
    seedSyncMeta("sub-a");
    markHomeReached("sub-a"); // 배지 알림은 로그인하고 홈에 들어온 뒤부터
    markBadgesSeen();
    render(<BadgeWatcher />);
    act(() => saveSavedList([POLICY.id]));
    const sheet = await screen.findByRole("dialog", { name: "‘첫 관심’ 배지를 받았어요" });
    expect(sheet.querySelector(".badge-earned [data-badge='first_save']")).not.toBeNull();
    expect(sheet.querySelectorAll(".badge-ring")).toHaveLength(2);
  });
});

describe("3. 하트", () => {
  it("담을 때만 톡 — 처음 그릴 때와 뺄 때는 움직이지 않는다", async () => {
    enableLogin();
    signInAs("sub-a");
    render(<SaveButton policyId={POLICY.id} policyName={POLICY.name} />);
    const heart = await screen.findByRole("button", { name: /관심 지원금에 담기/ });
    expect(heart.querySelector(".heart-pop")).toBeNull();
    const user = userEvent.setup();
    await user.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("true");
    expect(heart.querySelector(".heart-pop")).not.toBeNull();
    await user.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    expect(heart.querySelector(".heart-pop")).toBeNull();
  });
});

describe("4. 체크할 때", () => {
  it("누른 줄의 '확인함'만 떠오른다 — 처음부터 체크된 줄은 그대로", async () => {
    function Row({ initial }: { initial: boolean }) {
      const [checked, setChecked] = useState(initial);
      return <ChecklistRow checked={checked} label="수압 · 물 빠짐" onChange={setChecked} />;
    }
    const first = render(<Row initial />);
    expect(screen.getByText("확인함").closest(".check-in")).toBeNull();
    expect(document.querySelector(".check-flash")).toBeNull();
    first.unmount();

    render(<Row initial={false} />);
    await userEvent.setup().click(screen.getByRole("checkbox", { name: /수압 · 물 빠짐/ }));
    expect(screen.getByText("확인함").closest(".check-in")).not.toBeNull();
    // 누른 줄은 한 번 반짝인다
    expect(screen.getByRole("checkbox", { name: /수압 · 물 빠짐/ }).closest("label")!.querySelector(".check-flash")).not.toBeNull();
  });
});

describe("동작 줄이기", () => {
  it("휴대폰에서 '동작 줄이기'를 켜면 네 곳 모두 움직이지 않는다", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const name of [".sheet-in", ".sheet-backdrop", ".badge-earned", ".badge-ring", ".heart-pop", ".check-in", ".check-flash"]) {
      expect(reduce, name).toContain(name);
    }
  });
});
