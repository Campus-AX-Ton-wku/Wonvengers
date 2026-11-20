// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import NotificationsPage from "@/app/notifications/page";
import { resetAuthForTests } from "@/lib/auth";
import { loadInboxSeen } from "@/lib/inbox";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveSavedList } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const 익산_대학생 = { birthDate: birthDateForAge(23), region: "전북특별자치도 익산시" as const, status: "대학생" as const, incomeBracket: 1, housingType: "월세" as const };

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("/notifications — 알림함", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다", () => {
    enableLogin();
    render(<NotificationsPage />);
    expect(replacePage).toHaveBeenCalledWith("/onboarding");
  });

  it("알릴 게 없으면 무엇을 모아 주는지 말한다", async () => {
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    enableLogin(); signInAs("sub-a", { consent: false });
    render(<NotificationsPage />);
    expect(await screen.findByText("새 소식이 없어요")).toBeTruthy();
  });

  it("찜한 지원금 마감 임박 · 새로 열린 맞춤 지원금을 칸별로, 처음 보는 건 '새 소식', 본 뒤에는 읽음", async () => {
    vi.setSystemTime(new Date("2026-04-05T03:00:00Z")); // 청년월세(전국)는 3/30에 열렸다
    enableLogin(); signInAs("sub-a", { consent: false });
    saveAnswers(익산_대학생);
    render(<NotificationsPage />);
    const opened = await screen.findByRole("region", { name: "새로 신청이 열렸어요" });
    const row = within(opened).getByRole("link", { name: /청년월세/ });
    expect(row.getAttribute("href")).toBe("/find/policies/moland-youth-rent-support");
    expect(within(row).getByText("새 소식")).toBeTruthy();
    expect(loadInboxSeen().has("opened:moland-youth-rent-support:2026-03-30")).toBe(true);
  });

  it("마감이 다가오는 찜은 준비 화면으로 간다", async () => {
    vi.setSystemTime(new Date("2026-09-25T03:00:00Z"));
    enableLogin(); signInAs("sub-a", { consent: false });
    saveAnswers(익산_대학생);
    saveSavedList(["iksan-youth-rent-support"]);
    render(<NotificationsPage />);
    const soon = await screen.findByRole("region", { name: "마감이 다가와요" });
    const row = within(soon).getByRole("link");
    expect(row.getAttribute("href")).toBe("/find/policies/iksan-youth-rent-support/prepare");
    expect(within(row).getByText("D-5")).toBeTruthy();
  });
});
