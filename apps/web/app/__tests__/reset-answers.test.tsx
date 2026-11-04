// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));

import FindPage from "@/app/find/page";
import FindPoliciesPage from "@/app/find/policies/page";
import FindResultPage from "@/app/find/result/page";
import { resetAuthForTests } from "@/lib/auth";
import { loadRemote, saveRemote } from "@/lib/remote";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  readLocalContent,
  saveAnswers,
  saveAnsweredKeys,
  saveChecklist,
  saveDeclared,
  saveListing,
} from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import { emptyContent } from "@/lib/user-data";
import { enableLogin, remoteItem, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";
import { resetNavigation, routerMock } from "./navigation-mock";

/**
 * "처음부터 다시" (설계 '화면' 7). 지우는 것: 1층 답, 2층 계약 조건·자격 답, 신청 체크리스트,
 * perky.declared. 남기는 것: 로그인 상태, 가입 시트 닫음 기록. 지운 뒤 /find?q=birth 로 replace.
 */
const 답 = {
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

function 답심기(): void {
  saveAnswers(답);
  saveAnsweredKeys(["birthDate", "region", "status", "incomeBracket", "housingType"]);
  saveListing({
    region: "전북특별자치도 익산시",
    contractType: "월세",
    deposit: 3_000_000,
    rentOrYearlyAmount: 400_000,
    managementFee: 50_000,
    oneTimeMoveCost: 0,
    contractStartDate: "2026-03-01",
    months: 12,
    confirmedMatchesActualContract: true,
  });
  saveDeclared("singleHousehold", true);
  saveChecklist("iksan-newcomer-moving-cost-support", { eligibility: true, period: true, documents: false });
  window.localStorage.setItem("perky.onboarded", "1");
  window.localStorage.setItem("perky.signup-dismissed", "1");
}

async function 다시하기(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole("button", { name: "처음부터 다시" }));
  const sheet = screen.getByRole("dialog", { name: "고른 답을 모두 지우고 첫 질문부터 다시 할까요?" });
  await user.click(within(sheet).getByRole("button", { name: "다시 하기" }));
}

beforeEach(() => {
  resetSyncForTests();
  resetAuthForTests();
  vi.mocked(loadRemote).mockReset();
  vi.mocked(saveRemote).mockReset();
});

afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

describe("/find/policies — '조건 수정' 옆", () => {
  it("취소하면 아무것도 지우지 않는다", async () => {
    답심기();
    resetNavigation("/find/policies", "/find?q=birth");
    const user = userEvent.setup();
    render(<FindPoliciesPage />);

    await user.click(await screen.findByRole("button", { name: "처음부터 다시" }));
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(loadAnswers()).toEqual(답);
  });

  it("1·2층 답과 체크리스트를 지우고 /find?q=birth 로 replace — 온보딩·가입 시트 기록은 남긴다", async () => {
    답심기();
    resetNavigation("/find/policies", "/find?q=birth");
    const user = userEvent.setup();
    render(<FindPoliciesPage />);

    const row = (await screen.findByRole("link", { name: /조건 수정/ })).parentElement!;
    expect(within(row).getByRole("button", { name: "처음부터 다시" })).toBeTruthy();
    await 다시하기(user);

    expect(readLocalContent()).toEqual(emptyContent());
    expect(window.localStorage.getItem("perky.onboarded")).toBe("1");
    expect(window.localStorage.getItem("perky.signup-dismissed")).toBe("1");
    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=birth");
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe("/find — 답 요약 줄 끝", () => {
  it("답이 있으면 요약 줄 끝에 있고, 다시 하면 첫 질문으로 돌아가 요약 줄이 사라진다", async () => {
    saveAnswers({ ...EMPTY_ANSWERS, birthDate: "2002-03-14", region: "전북특별자치도 익산시" });
    saveAnsweredKeys(["birthDate", "region"]);
    resetNavigation("/find?q=status", "/find");
    const user = userEvent.setup();
    render(<FindPage />);

    const bar = await screen.findByRole("navigation", { name: "고른 답" });
    expect(within(bar).getByRole("button", { name: "처음부터 다시" })).toBeTruthy();
    await 다시하기(user);

    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=birth");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("생년월일이 어떻게 되시나요?");
    expect(screen.queryByRole("navigation", { name: "고른 답" })).toBeNull();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
  });

  it("답이 하나도 없으면 버튼이 없다", async () => {
    resetNavigation("/find");
    render(<FindPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "처음부터 다시" })).toBeNull();
  });
});

describe("/find/result — 하단 CTA 아래", () => {
  it("다시 하면 지우고 /find?q=birth 로 replace", async () => {
    답심기();
    resetNavigation("/find/result", "/find?q=birth");
    const user = userEvent.setup();
    render(<FindResultPage />);

    await 다시하기(user);

    expect(readLocalContent()).toEqual(emptyContent());
    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=birth");
  });
});

describe("로그인 상태", () => {
  it("비운 데이터를 기다리지 않고 바로 PUT 한다 — 다른 기기에서도 빈 상태", async () => {
    enableLogin();
    signInAs();
    seedSyncMeta();
    답심기();
    // 이 기기는 09:00 에 서버와 맞췄다 — 서버에도 같은 답이 있다. (서버가 비어 있으면 비운 사본이
    // 서버와 같아서 lib/sync.ts 가 올리지 않는다.)
    vi.mocked(loadRemote).mockResolvedValue(remoteItem(readLocalContent(), "2026-11-04T09:00:00.000Z"));
    vi.mocked(saveRemote).mockResolvedValue({ ok: true, updatedAt: "2026-11-04T09:05:00.000Z" });
    resetNavigation("/find/policies", "/find?q=birth");
    const user = userEvent.setup();
    render(<FindPoliciesPage />);
    await screen.findByRole("link", { name: "내 계정" });

    await 다시하기(user);

    await waitFor(() => expect(saveRemote).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(saveRemote).mock.calls[0];
    expect({
      answers: payload.answers,
      listing: payload.listing,
      profile: payload.profile,
      declared: payload.declared,
      checklists: payload.checklists,
    }).toEqual(emptyContent());
  });
});
