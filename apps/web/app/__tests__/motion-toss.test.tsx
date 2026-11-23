// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import { EmptyState, SaveButton } from "@/app/components";
import { ToastHost } from "@/app/components/ToastHost";
import { GuideCard } from "@/app/guides/GuideCard";
import GuidePage from "@/app/guides/[id]/page";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { findGuide } from "@/lib/guides";
import { resetSyncForTests } from "@/lib/sync";
import type { PolicyMeta } from "@/lib/types";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

/**
 * 토스 영상(11/23 ggue)에서 가져온 움직임 #1~#5 — 누를 때 반응 · 하트 두 단계 · 담은 뒤 아래 알림 · 알림 교체 · 빈 화면 그림.
 * 움직임은 CSS 라 jsdom 이 돌리지 않는다 — 클래스가 붙는 때 · 알림 내용 · 동작 줄이기에서 꺼지는지를 본다.
 */

const POLICY = (policiesJson as PolicyMeta[])[0];

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
});
afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

describe("#1 누를 때 반응", () => {
  it("카드는 눌린 동안 살짝 작아지고(press), 카드 안 줄은 밝은 배경이 깔린다(press-row)", async () => {
    render(<GuideCard guide={findGuide("before-contract")!} />);
    expect(screen.getByRole("link").className).toContain("press");
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    const toc = screen.getByRole("navigation", { name: "목차" });
    for (const row of within(toc).getAllByRole("link")) expect(row.className).toContain("press-row");
  });
});

describe("#3 · #4 담은 뒤 아래 알림", () => {
  it("담으면 '관심 지원금에 담았어요 [보러가기]', 빼면 '관심에서 뺐어요'가 앞 알림을 밀어내고 올라온다", async () => {
    enableLogin();
    signInAs("sub-a");
    render(
      <>
        <SaveButton policyId={POLICY.id} policyName={POLICY.name} />
        <ToastHost />
      </>
    );
    const user = userEvent.setup();
    const heart = await screen.findByRole("button", { name: /관심 지원금에 담기/ });
    await user.click(heart);
    const host = screen.getByRole("status");
    const added = within(host).getByText("관심 지원금에 담았어요").closest("[data-toast]")!;
    expect(within(added as HTMLElement).getByRole("link", { name: "보러가기" }).getAttribute("href")).toBe("/saved");
    expect(added.querySelector(".toast-check-mark")).not.toBeNull();

    await user.click(heart);
    const removed = within(host).getByText("관심에서 뺐어요").closest("[data-toast]")!;
    expect(removed.getAttribute("data-leaving")).toBe("false");
    expect(added.getAttribute("data-leaving")).toBe("true");
  });

  it("로그인 전에는 하트가 로그인 창을 열 뿐 — 알림은 없다", async () => {
    enableLogin();
    render(
      <>
        <SaveButton policyId={POLICY.id} policyName={POLICY.name} />
        <ToastHost />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: /관심 지원금에 담기/ }));
    expect(screen.queryByText("관심 지원금에 담았어요")).toBeNull();
  });
});

describe("#5 빈 화면 그림", () => {
  it("글이 먼저, 그림은 조금 늦게 돌며 자리를 잡는다(empty-pop)", () => {
    render(<EmptyState character="empty" title="찾는 화면이 없어요" />);
    expect(document.querySelector(".empty-pop")).not.toBeNull();
  });
});

describe("동작 줄이기 (#1~#5)", () => {
  it("휴대폰 '동작 줄이기'를 켜면 알림 · 하트 · 빈 화면 그림이 움직이지 않는다", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const name of [".toast-in", ".toast-out", ".toast-check-circle", ".toast-check-mark", ".empty-pop", ".heart-pop"]) {
      expect(reduce, name).toContain(name);
    }
  });
});
