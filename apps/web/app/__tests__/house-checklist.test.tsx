// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChecklistPage from "@/app/guides/checklist/page";
import { HOUSE_CHECKLIST_KEY } from "@/lib/storage";

/** 집 보러 갈 때 체크리스트 (docs/기획/2026-11-22-집-보기-체크리스트-설계.md, ggue 11/22) */

beforeEach(() => window.localStorage.clear());
const progress = () => screen.getByText(/^\d+\/22 확인$/);
const row = (name: RegExp) => screen.getByRole("checkbox", { name });

describe("집 보러 갈 때 체크리스트 /guides/checklist", () => {
  it("네 무리 22줄, 처음엔 0/22 · 지우기 버튼 없음, 판정 문구 없음", () => {
    render(<ChecklistPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("집 보러 갈 때 체크리스트");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["집 안", "주변", "돈 · 계약", "서류"]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(22);
    expect(progress().textContent).toBe("0/22 확인");
    expect(screen.queryByRole("button", { name: "체크 모두 지우기" })).toBeNull();
    expect(screen.queryByText(/계약해도/)).toBeNull();
  });

  it("누르면 체크 · 진행 글자 · 저장된 기록이 바뀌고, [체크 모두 지우기]로 비운다", async () => {
    const user = userEvent.setup();
    render(<ChecklistPage />);
    await user.click(row(/수압 · 물 빠짐/));
    expect(row(/수압 · 물 빠짐/)).toHaveProperty("checked", true);
    expect(progress().textContent).toBe("1/22 확인");
    expect(JSON.parse(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)!).checked).toEqual(["water"]);

    await user.click(screen.getByRole("button", { name: "체크 모두 지우기" }));
    expect(progress().textContent).toBe("0/22 확인");
    expect(row(/수압 · 물 빠짐/)).toHaveProperty("checked", false);
    // 빈 목록으로 저장한다 — 계정에도 '모두 지움'이 올라가게(11/23)
    expect(JSON.parse(window.localStorage.getItem(HOUSE_CHECKLIST_KEY)!).checked).toEqual([]);
  });

  it("다시 열면 저장된 체크가 그대로 — 서류 줄도", async () => {
    window.localStorage.setItem(HOUSE_CHECKLIST_KEY, JSON.stringify({ v: 1, checked: ["night", "paper:등기부등본"] }));
    render(<ChecklistPage />);
    expect(await screen.findByText("2/22 확인")).toBeTruthy();
    expect(row(/밤길/)).toHaveProperty("checked", true);
    expect(row(/^등기부등본/)).toHaveProperty("checked", true);
  });

  it("서류 무리 아래 '자세히'는 계약 전 가이드로, 출처는 '출처 7곳'으로 접혀 있다", () => {
    render(<ChecklistPage />);
    const paper = screen.getByRole("region", { name: "서류" });
    expect(within(paper).getByRole("link", { name: /자세히는/ }).getAttribute("href")).toBe("/guides/before-contract");
    const sources = screen.getByRole("region", { name: "출처" });
    expect(within(sources).getByText("출처 7곳")).toBeTruthy();
    expect(sources.querySelector("details")?.open).toBe(false);
  });
});
