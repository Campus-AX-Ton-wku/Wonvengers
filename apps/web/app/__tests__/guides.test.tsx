// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import GuidesPage from "@/app/guides/page";
import GuidePage, { generateStaticParams } from "@/app/guides/[id]/page";

describe("주거 가이드 화면", () => {
  it("목록 — 세 편이 각 글로 간다", () => {
    render(<GuidesPage />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/guides/"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/guides/before-contract",
      "/guides/protect-deposit",
      "/guides/where-documents",
    ]);
  });

  it("정적 export 로 세 편을 미리 만든다", () => {
    expect(generateStaticParams()).toEqual([{ id: "before-contract" }, { id: "protect-deposit" }, { id: "where-documents" }]);
  });

  it("글 — 제목 · 칸 · 출처(새 창) · 확인일", async () => {
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("보증금 지키는 법");
    expect(screen.getByRole("heading", { level: 2, name: "1. 이사한 날 바로 전입신고" })).toBeTruthy();
    const sources = screen.getByRole("region", { name: "출처" });
    const first = within(sources).getAllByRole("link")[0];
    expect(first.getAttribute("target")).toBe("_blank");
    expect(first.getAttribute("rel")).toContain("noopener");
    expect(within(sources).getByText(/2026\.11\.20에 확인했어요/)).toBeTruthy();
  });
});
