// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import AccountPage from "@/app/account/page";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { emptyLedger, toggleLine } from "@/lib/ledger";
import { loadRemote, saveRemote } from "@/lib/remote";
import { loadProfileCard, saveAnswers, saveBadges, saveChecklist, saveLedger, saveSavedList } from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import type { PolicyMeta } from "@/lib/types";
import { enableLogin, remoteItem, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

/** 내 정보 개편 · 프로필 꾸미기 (docs/기획/2026-11-22-내-프로필-설계.md §3 · §4) */

const 익산_대학생 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "대학생" as const, incomeBracket: 1, housingType: "월세" as const };

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
  vi.mocked(loadRemote).mockReset();
  vi.mocked(saveRemote).mockReset();
  enableLogin();
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

function 로그인한채로() {
  saveAnswers(익산_대학생);
  signInAs();
  seedSyncMeta();
  vi.mocked(loadRemote).mockResolvedValue(remoteItem());
  vi.mocked(saveRemote).mockResolvedValue({ ok: true, updatedAt: "2026-11-22T09:00:00.000Z" });
  render(<AccountPage />);
}

describe("/account 내 정보 — 프로필 카드", () => {
  it("상단바 제목 '내 정보'(뒤로 없음), 기본 이름 · 안내 · 조건 칩 · 두 버튼", async () => {
    로그인한채로();
    const card = await screen.findByRole("region", { name: "내 프로필" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("내 정보");
    expect(screen.queryByRole("button", { name: "이전 단계로" })).toBeNull();
    expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe("익산 사는 대학생");
    expect(within(card).getByText("내 조건으로 지은 이름이에요 · 바꿀 수 있어요")).toBeTruthy();
    for (const chip of ["25세", "익산시", "대학생", "월세"]) expect(within(card).getByText(chip)).toBeTruthy();
    expect(within(card).getByRole("button", { name: "프로필 꾸미기" })).toBeTruthy();
    expect(within(card).getByRole("link", { name: "내 조건 수정" }).getAttribute("href")).toBe("/find");
  });

  it("꾸미기 — 이름 · 그림 · 색을 고르고 [저장]하면 카드와 기록이 바뀐다", async () => {
    로그인한채로();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "프로필 꾸미기" }));
    const sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    const name = within(sheet).getByRole("textbox", { name: "이름" });
    expect(name.getAttribute("placeholder")).toBe("익산 사는 대학생");
    await user.type(name, "월세 2년 차");
    await user.click(within(sheet).getByRole("radio", { name: "학사모" }));
    await user.click(within(sheet).getByRole("radio", { name: "민트" }));
    await user.click(within(sheet).getByRole("button", { name: "저장" }));

    expect(screen.queryByRole("dialog", { name: "프로필 꾸미기" })).toBeNull();
    const card = screen.getByRole("region", { name: "내 프로필" });
    expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe("월세 2년 차");
    expect(within(card).queryByText(/내 조건으로 지은 이름이에요/)).toBeNull();
    expect(card.querySelector("img[data-icon3d='student']")).not.toBeNull();
    expect(loadProfileCard()).toEqual({ icon: "student", color: "mint", name: "월세 2년 차", pinnedBadge: null });
  });

  it("[저장]을 누르지 않고 닫으면 그대로", async () => {
    로그인한채로();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "프로필 꾸미기" }));
    const sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    await user.type(within(sheet).getByRole("textbox", { name: "이름" }), "바뀌면 안 돼");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "프로필 꾸미기" })).toBeNull());
    expect(loadProfileCard()).toBeNull();
    expect(within(screen.getByRole("region", { name: "내 프로필" })).getByRole("heading", { level: 2 }).textContent).toBe("익산 사는 대학생");
  });

  it("이름은 10자까지 — 글자 수를 보여 준다", async () => {
    로그인한채로();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "프로필 꾸미기" }));
    const sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    const name = within(sheet).getByRole("textbox", { name: "이름" }) as HTMLInputElement;
    await user.type(name, "가나다라마바사아자차카타");
    expect(name.value).toBe("가나다라마바사아자차");
    expect(within(sheet).getByText("10/10")).toBeTruthy();
  });
});

describe("/account 내 정보 — 내 기록", () => {
  it("관심 지원금 · 신청 준비 중 · 달력 기록 개수, 누르면 관심 · 관심 · 달력 탭 (금액은 안 보인다)", async () => {
    const [a, b] = (policiesJson as PolicyMeta[]).map((p) => p.id);
    saveSavedList([a, b]);
    saveChecklist(a, { eligibility: true, period: false, documents: false });
    saveLedger(toggleLine(emptyLedger(), "2026-11", "rent", 400_000));
    로그인한채로();
    const records = await screen.findByRole("region", { name: "내 기록" });
    expect(within(records).getByRole("link", { name: /관심 지원금\s*2개/ }).getAttribute("href")).toBe("/saved");
    expect(within(records).getByRole("link", { name: /신청 준비 중\s*\d개/ }).getAttribute("href")).toBe("/saved");
    expect(within(records).getByRole("link", { name: /달력 기록\s*1달/ }).getAttribute("href")).toBe("/ledger");
    expect(records.textContent).not.toMatch(/\d\s*(만\s*)?원/); // 금액(… 원)은 없다 — "지원금"의 원은 아니다
  });
});

describe("/account 내 정보 — 배지 (11/22 내 프로필 ②)", () => {
  it("배지 n/8 — 받은 칸은 받은 날, 아직인 칸은 진행(0/5) 또는 '아직'", async () => {
    saveBadges({ first_calc: "2026-11-18" });
    로그인한채로();
    const section = await screen.findByRole("region", { name: /배지 1\/8/ });
    const cell = (label: string) => within(section).getByText(label).closest("li")!;
    expect(cell("첫 계산").textContent).toContain("11.18");
    expect(cell("첫 계산").querySelector("[data-earned='yes']")).not.toBeNull();
    expect(cell("관심 5개").textContent).toContain("0/5");
    expect(cell("관심 5개").querySelector("[data-earned='no']")).not.toBeNull();
    expect(cell("첫 관심").textContent).toContain("아직");
  });

  it("대표 배지 — 꾸미기 창에서 받은 배지 중 하나를 걸면 그림 오른쪽 아래에 붙는다, [없음]으로 뗀다", async () => {
    saveBadges({ first_calc: "2026-11-18" });
    로그인한채로();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "프로필 꾸미기" }));
    let sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    const pins = within(sheet).getByRole("group", { name: /대표 배지/ });
    expect(within(pins).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? r.closest("label")?.textContent)).toEqual(["없음", "첫 계산"]);
    await user.click(within(pins).getByRole("radio", { name: "첫 계산" }));
    await user.click(within(sheet).getByRole("button", { name: "저장" }));
    expect(loadProfileCard()?.pinnedBadge).toBe("first_calc");
    expect(screen.getByRole("region", { name: "내 프로필" }).querySelector("[data-badge='first_calc']")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "프로필 꾸미기" }));
    sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    await user.click(within(within(sheet).getByRole("group", { name: /대표 배지/ })).getByRole("radio", { name: "없음" }));
    await user.click(within(sheet).getByRole("button", { name: "저장" }));
    expect(loadProfileCard()?.pinnedBadge).toBeNull();
  });

  it("받은 배지가 없으면 대표 배지 줄은 안내만", async () => {
    로그인한채로();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "프로필 꾸미기" }));
    const sheet = screen.getByRole("dialog", { name: "프로필 꾸미기" });
    expect(within(sheet).getByText("배지를 받으면 여기서 걸 수 있어요.")).toBeTruthy();
  });
});
