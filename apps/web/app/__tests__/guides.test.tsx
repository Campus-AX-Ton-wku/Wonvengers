// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import GuidesPage from "@/app/guides/page";
import GuidePage, { generateStaticParams } from "@/app/guides/[id]/page";
import GuideStepPage, { generateStaticParams as stepParams } from "@/app/guides/[id]/[step]/page";

describe("주거 가이드 화면", () => {
  it("목록 — 세 편이 각 글의 목차로 간다", () => {
    render(<GuidesPage />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/guides/"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/guides/before-contract",
      "/guides/protect-deposit",
      "/guides/where-documents",
    ]);
  });

  it("정적 export — 목차 세 장, 섹션 페이지는 모든 장(5 + 5 + 2)", () => {
    expect(generateStaticParams()).toEqual([{ id: "before-contract" }, { id: "protect-deposit" }, { id: "where-documents" }]);
    const steps = stepParams();
    expect(steps).toHaveLength(12);
    expect(steps.filter((p) => p.id === "protect-deposit").map((p) => p.step)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

/** 노션처럼 — 가이드 첫 페이지는 목차, 섹션은 한 장에 하나 (11/20 ggue) */
describe("목차 페이지 /guides/[id]", () => {
  it("제목 · 몇 장 · 몇 분, 섹션마다 그 장으로 가는 링크", async () => {
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("보증금 지키는 법");
    expect(screen.getByText(/^5장 · 약 \d+분$/)).toBeTruthy();
    const toc = screen.getByRole("navigation", { name: "목차" });
    const links = within(toc).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([1, 2, 3, 4, 5].map((n) => `/guides/protect-deposit/${n}`));
    expect(links[1].textContent).toMatch(/확정일자/);
  });

  it("출처(새 창) · 확인일은 목차 아래에 있다", async () => {
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    const sources = screen.getByRole("region", { name: "출처" });
    const first = within(sources).getAllByRole("link")[0];
    expect(first.getAttribute("target")).toBe("_blank");
    expect(first.getAttribute("rel")).toContain("noopener");
    expect(within(sources).getByText(/2026\.11\.20에 확인했어요/)).toBeTruthy();
  });
});

describe("섹션 페이지 /guides/[id]/[step]", () => {
  it("한 장에 한 섹션 — 비유 제목 · 한 줄 할 일 · 몇 번째 장, ← 는 목차", async () => {
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "2" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/확정일자/);
    expect(screen.getByText("보증금 지키는 법 · 2/5")).toBeTruthy();
    expect(screen.getByText("계약서에 확정일자를 받아요.")).toBeTruthy();
    // 정확한 용어 · 뜻은 '용어 풀이'에 남긴다
    expect(within(screen.getByRole("region", { name: "용어 풀이" })).getByText("우선변제권")).toBeTruthy();
  });

  it("이전 · 다음 — 첫 장은 이전 대신 목차, 마지막 장은 다음 대신 목차로", async () => {
    const { unmount } = render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "2" }) }));
    expect(screen.getByRole("link", { name: /이전/ }).getAttribute("href")).toBe("/guides/protect-deposit/1");
    expect(screen.getByRole("link", { name: /다음/ }).getAttribute("href")).toBe("/guides/protect-deposit/3");
    unmount();

    const first = render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "1" }) }));
    expect(screen.queryByRole("link", { name: /이전/ })).toBeNull();
    first.unmount();

    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "5" }) }));
    expect(screen.queryByRole("link", { name: /다음/ })).toBeNull();
    expect(screen.getByRole("link", { name: "목차로" }).getAttribute("href")).toBe("/guides/protect-deposit");
  });

  it("'어디서' 칸 제목은 장에 맞게 — 서류는 '어디서 떼요', 기본은 '어디서 해요'", async () => {
    const docs = render(await GuideStepPage({ params: Promise.resolve({ id: "where-documents", step: "1" }) }));
    expect(screen.getByRole("heading", { level: 2, name: "어디서 떼요" })).toBeTruthy();
    docs.unmount();
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "1" }) }));
    expect(screen.getByRole("heading", { level: 2, name: "어디서 해요" })).toBeTruthy();
  });
});
