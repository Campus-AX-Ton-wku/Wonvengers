// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isEntryPage } from "@/lib/entry";
import { resetNavigation, routerMock } from "./navigation-mock";
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
  it("제목과 섹션마다 그 장으로 가는 링크 — '5장 · 약 3분' 같은 글은 두지 않는다 (11/20 ggue)", async () => {
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("보증금 지키는 법");
    expect(screen.queryByText(/\d+장/)).toBeNull();
    expect(screen.queryByText(/약 \d+분/)).toBeNull();
    const toc = screen.getByRole("navigation", { name: "목차" });
    const links = within(toc).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([1, 2, 3, 4, 5].map((n) => `/guides/protect-deposit/${n}`));
    // 목차 한 줄 = 위에 용어, 아래에 제목 (11/21 ggue 시안 '내용은 크게')
    expect(within(links[1]).getByText("확정일자")).toBeTruthy();
    expect(within(links[1]).getByText("계약서에 번호표를 받아 둬요")).toBeTruthy();
  });

  it("출처는 목차 아래 '출처 n곳' 한 줄로 접어 둔다 — 펼치면 기관 · 주제, 새 창. '~에 확인했어요' 문단은 두지 않는다 (11/21 ggue 시안)", async () => {
    render(await GuidePage({ params: Promise.resolve({ id: "protect-deposit" }) }));
    const sources = screen.getByRole("region", { name: "출처" });
    const details = sources.querySelector("details");
    expect(details?.open).toBe(false);
    expect(within(sources).getByText("출처 5곳")).toBeTruthy();
    const first = within(sources).getAllByRole("link", { hidden: true })[0];
    expect(first.getAttribute("target")).toBe("_blank");
    expect(first.getAttribute("rel")).toContain("noopener");
    expect(within(first).getByText("찾기쉬운 생활법령")).toBeTruthy();
    expect(within(first).getByText("주택임대차(대항력·우선변제권·임차권등기)")).toBeTruthy();
    expect(screen.queryByText(/확인했어요/)).toBeNull();
  });
});

describe("섹션 페이지 /guides/[id]/[step]", () => {
  it("한 장에 한 섹션 — 윗줄은 용어 · 몇 번째 장, 그 아래 제목 · 한 줄 할 일, ← 는 목차 (11/21 ggue)", async () => {
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "2" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("계약서에 번호표를 받아 둬요");
    expect(screen.getByText("확정일자 · 2/5")).toBeTruthy();
    // 가이드 이름 윗줄은 용어로 바꿨다 — ← 가 그 가이드 목차로 돌아간다
    expect(screen.queryByText("보증금 지키는 법 · 2/5")).toBeNull();
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

  it("서류 떼는 곳 1장 — 서류마다 [온라인으로 떼기 ↗] 새 창 링크, 아래에 지도 버튼 (11/22)", async () => {
    render(await GuideStepPage({ params: Promise.resolve({ id: "where-documents", step: "1" }) }));
    const list = screen.getByRole("region", { name: "어디서 떼요" });
    const links = within(list).getAllByRole("link", { name: /온라인으로 떼기/ });
    expect(links).toHaveLength(6);
    expect(links[0].getAttribute("href")).toBe("https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010001&CappBizCD=13100000015&tp_seq=01");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(within(list).getByText("임대차계약서 사본")).toBeTruthy();
    expect(screen.getByRole("link", { name: /가까운 주민센터 · 무인민원발급기 지도 보기/ }).getAttribute("href")).toBe("/guides/places");
  });
});

/**
 * 장 넘기기와 뒤로가기 (11/21 ggue — 장에서 ← 를 누르면 그 가이드 목차로).
 * ← 는 휴대폰 뒤로가기와 같아서(lib/navigation.ts useBack) 기록을 한 칸 되짚는다. 예전에는 [이전] · [다음] 이
 * 기록을 쌓아 ← 가 직전 장으로 갔다(1장 → 다음 → 2장 ← = 1장). 이제 장 넘기기는 지금 칸을 바꿔 끼워
 * 기록이 '목차 → 지금 장' 두 칸뿐이다.
 */
describe("장 넘기기 — 기록을 쌓지 않는다", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("[다음] · [이전]은 지금 칸을 바꿔 끼운다(replace) — 몇 장을 넘겨도 ← 는 목차로", async () => {
    resetNavigation("/guides/protect-deposit/2", "/guides/protect-deposit");
    const length = window.history.length;
    const user = userEvent.setup();
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "2" }) }));

    await user.click(screen.getByRole("link", { name: /다음/ }));
    expect(routerMock.replace).toHaveBeenLastCalledWith("/guides/protect-deposit/3");
    await user.click(screen.getByRole("link", { name: /이전/ }));
    expect(routerMock.replace).toHaveBeenLastCalledWith("/guides/protect-deposit/1");
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
  });

  it("[목차로]는 ← 와 같다 — 앞 칸이 목차면 한 칸 되돌아간다(목차에서 ← 가 다시 마지막 장으로 오지 않게)", async () => {
    resetNavigation("/guides/protect-deposit/5", "/guides/protect-deposit");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const user = userEvent.setup();
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "5" }) }));

    await user.click(screen.getByRole("link", { name: "목차로" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("주소로 장을 바로 열었으면(이 탭 첫 화면) 장을 넘겨도 첫 화면 표가 따라간다 — ← 가 앱 밖이 아니라 목차로", async () => {
    resetNavigation("/guides/protect-deposit/1");
    const user = userEvent.setup();
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "1" }) }));

    await user.click(screen.getByRole("link", { name: /다음/ }));
    expect(routerMock.replace).toHaveBeenLastCalledWith("/guides/protect-deposit/2");
    expect(isEntryPage()).toBe(true);
  });

  it("주소로 마지막 장을 바로 열었으면 [목차로]는 목차로 바꿔 끼운다", async () => {
    resetNavigation("/guides/protect-deposit/5");
    const user = userEvent.setup();
    render(await GuideStepPage({ params: Promise.resolve({ id: "protect-deposit", step: "5" }) }));

    await user.click(screen.getByRole("link", { name: "목차로" }));
    expect(routerMock.replace).toHaveBeenLastCalledWith("/guides/protect-deposit");
  });
});
