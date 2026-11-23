// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import SavedPage from "@/app/saved/page";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveChecklist, saveDocumentChecks, saveSavedList } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const 주거급여서류 = (policiesJson as PolicyMeta[]).find((p) => p.id === "youth-housing-benefit-split-payment")?.documents ?? [];
const 익산_재직 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "재직" as const, incomeBracket: 1, housingType: "월세" as const };

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("/saved — 관심 탭", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다 — 찜은 로그인한 사람만 쓴다", async () => {
    enableLogin();
    render(<SavedPage />);
    expect(replacePage).toHaveBeenCalledWith("/onboarding");
  });

  it("관심 지원금 — 비면 하트 안내와 [지원금 보러 가기], 있으면 건수 · 마감 배지 · 진행 막대 (홈에 있던 그대로)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const { unmount } = render(<SavedPage />);
    const empty = await screen.findByRole("region", { name: "관심 지원금" });
    expect(within(empty).getByText("아직 관심 지원금이 없어요")).toBeTruthy();
    // 시안 '관심 탭 · 비었을 때' (11/20) — 하트와 관심 지원금을 문장으로 잇는다
    expect(within(empty).getByText(/지원금 목록에서 하트를 누르면/)).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "지원금 보러 가기" }).getAttribute("href")).toBe("/find/policies");
    unmount();

    saveSavedList(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
    render(<SavedPage />);
    const list = await screen.findByRole("region", { name: "관심 지원금" });
    expect(within(list).getByRole("heading", { level: 2 }).textContent).toBe("관심 지원금 2건");
    const card = within(list).getByRole("link", { name: /청년 주거급여 분리지급/ });
    expect(card.getAttribute("href")).toBe("/find/policies/youth-housing-benefit-split-payment/prepare");
    expect(within(card).getByText("상시")).toBeTruthy();
    expect(within(card).getByText(`서류 0/${주거급여서류.length} 준비`)).toBeTruthy();
    expect([...card.querySelectorAll("img[data-icon3d]")].map((img) => img.getAttribute("data-icon3d"))).toEqual(["housing-benefit"]);
    const closed = within(list).getByRole("link", { name: /청년월세 지원/ });
    expect(within(closed).getByText("접수 마감")).toBeTruthy();
    expect(within(closed).getByText(/다음 공고를 기다려요/)).toBeTruthy();
  });

  it("하단 섬에서 '관심'이 지금 화면이다", async () => {
    enableLogin(); signInAs("sub-a");
    render(<SavedPage />);
    const tabs = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(within(tabs).getByRole("link", { name: "관심" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "홈" }).getAttribute("aria-current")).toBeNull();
  });

  it("정렬 — 기본은 마감 가까운 순, '최근 찜한 순'을 누르면 찜한 순서", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    // 찜한 순서: 마감된 것을 가장 최근에 찜했다
    saveSavedList(["moland-youth-rent-support", "youth-housing-benefit-split-payment"]);
    render(<SavedPage />);
    const list = await screen.findByRole("region", { name: "관심 지원금" });
    const names = () => within(list).getAllByRole("listitem").map((li) => (/청년 주거급여/.test(li.textContent ?? "") ? "주거급여" : "청년월세"));
    expect(within(list).getByRole("button", { name: "마감 가까운 순" }).getAttribute("aria-pressed")).toBe("true");
    expect(names()).toEqual(["주거급여", "청년월세"]);
    await userEvent.setup().click(within(list).getByRole("button", { name: "최근 추가한 순" }));
    expect(names()).toEqual(["청년월세", "주거급여"]);
  });
});

/** 11/23 ggue — 내 정보 '신청 준비 중'이 관심 전체와 같은 목록을 보여 주던 것. 체크리스트를 하나라도 체크한 것만 */
describe("/saved — 신청 준비 중 보기", () => {
  const 주거급여 = "youth-housing-benefit-split-payment";
  const 청년월세 = "moland-youth-rent-support";
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("?view=preparing 으로 열면 체크를 하나라도 한 관심 지원금만 — 서류 체크도 체크다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList([주거급여, 청년월세]);
    saveDocumentChecks(주거급여, [주거급여서류[0].name]);
    window.history.replaceState(null, "", "/saved?view=preparing");
    render(<SavedPage />);
    const list = await screen.findByRole("region", { name: "신청 준비 중" });
    expect(within(list).getByRole("heading", { level: 2 }).textContent).toBe("신청 준비 중 1건");
    expect(within(list).getByRole("link", { name: /청년 주거급여 분리지급/ })).toBeTruthy();
    expect(within(list).queryByRole("link", { name: /청년월세 지원/ })).toBeNull();
    const tabs = screen.getByRole("group", { name: "보기" });
    expect(within(tabs).getByRole("button", { name: /신청 준비 중\s*1/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(tabs).getByRole("button", { name: /전체\s*2/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("다 체크한 것도 준비 중에 남는다 — 실제 신청했는지는 앱이 모른다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList([청년월세]);
    saveChecklist(청년월세, { eligibility: true, period: true, documents: true });
    window.history.replaceState(null, "", "/saved?view=preparing");
    render(<SavedPage />);
    const list = await screen.findByRole("region", { name: "신청 준비 중" });
    expect(within(list).getByRole("link", { name: /청년월세 지원/ })).toBeTruthy();
  });

  it("보기를 바꾸면 목록 · 주소가 같이 바뀐다, 준비 중이 비면 안내와 [관심 지원금 전체 보기]", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList([주거급여, 청년월세]);
    window.history.replaceState(null, "", "/saved");
    render(<SavedPage />);
    await screen.findByRole("region", { name: "관심 지원금" });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole("group", { name: "보기" })).getByRole("button", { name: /신청 준비 중/ }));
    expect(window.location.search).toBe("?view=preparing");
    const empty = screen.getByRole("region", { name: "신청 준비 중" });
    expect(within(empty).getByText("아직 준비를 시작한 지원금이 없어요")).toBeTruthy();
    await user.click(within(empty).getByRole("button", { name: "관심 지원금 전체 보기" }));
    expect(window.location.search).toBe("");
    expect(within(screen.getByRole("region", { name: "관심 지원금" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("관심 지원금이 하나도 없으면 보기 칸을 두지 않는다", async () => {
    enableLogin(); signInAs("sub-a");
    render(<SavedPage />);
    await screen.findByRole("region", { name: "관심 지원금" });
    expect(screen.queryByRole("group", { name: "보기" })).toBeNull();
  });
});
