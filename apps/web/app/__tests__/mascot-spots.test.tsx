// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import ApplicationPreparation from "@/app/find/policies/[id]/prepare/ApplicationPreparation";
import FindResultPage from "@/app/find/result/page";
import { LoginSheet } from "@/app/components";
import policiesJson from "@/data/policies.json";
import { reloadPage } from "@/lib/redirect";
import type { PolicyMeta } from "@/lib/types";

/**
 * 마스코트 새 자리 (2026-11-17 디자인 시안 '마스코트 배치 가이드').
 * 한 화면에 한 포즈, 캐릭터 옆에는 늘 같은 뜻의 글자가 있다.
 */
const poses = (root: ParentNode = document) =>
  [...root.querySelectorAll("[data-pose]")].map((el) => el.getAttribute("data-pose"));

describe("마스코트 새 자리", () => {
  it("로그인 시트 — wave, 제목 옆에 작게", () => {
    render(<LoginSheet title="로그인하고 찜해 둘까요?" description="설명" next="/find/policies" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "로그인하고 찜해 둘까요?" });
    expect(poses(dialog)).toEqual(["wave"]);
  });

  it("찾기 결과 불러오는 중 — search 와 그 뜻의 글자 (JS 가 뜨기 전 정적 HTML 이 이 상태다)", () => {
    const html = renderToString(<FindResultPage />);
    const box = document.createElement("div");
    box.innerHTML = html;
    expect(poses(box)).toEqual(["search"]);
    expect(box.querySelector('[role="status"]')?.textContent).toBe("답을 바탕으로 지원금을 찾고 있어요");
  });

  it("신청 준비 체크를 모두 마치면 success 와 그 뜻의 글자, 하나라도 풀면 사라진다", async () => {
    const user = userEvent.setup();
    const policy = (policiesJson as PolicyMeta[]).find((p) => p.id === "iksan-newcomer-moving-cost-support")!;
    render(<ApplicationPreparation policy={policy} />);
    await screen.findByRole("heading", { level: 1 });
    expect(poses()).toEqual([]);

    for (const name of [/자격 조건 확인/, /모집 기간 확인/, /준비 서류 확인/]) {
      await user.click(screen.getByRole("checkbox", { name }));
    }
    expect(poses()).toEqual(["success"]);
    expect(screen.getByText("준비를 모두 마쳤어요")).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: /모집 기간 확인/ }));
    expect(poses()).toEqual([]);
  });

  it("없는 페이지 — empty, 이유 한 줄과 처음 화면으로", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("찾는 페이지가 없어요");
    expect(poses()).toEqual(["empty"]);
    expect(screen.getByRole("link", { name: "처음 화면으로" }).getAttribute("href")).toBe("/");
  });

  it("오류 · 연결 끊김 — thinking, 다시 시도는 페이지를 새로 연다(못 받은 코드 조각까지 다시 받는다)", async () => {
    const user = userEvent.setup();
    render(<ErrorPage error={Object.assign(new Error("Loading chunk 12 failed"), { name: "ChunkLoadError" })} reset={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("화면을 불러오지 못했어요");
    expect(poses()).toEqual(["thinking"]);
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reloadPage).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "처음 화면으로" }).getAttribute("href")).toBe("/");
  });
});
