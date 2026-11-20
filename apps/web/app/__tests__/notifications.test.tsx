// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
vi.mock("@/data/policies.json", async (importOriginal) => {
  const real = ((await importOriginal()) as { default: { id: string }[] }).default;
  // 시험용 — 전입장려금이 11/21 에 처음 올라온 것으로(지금 데이터는 모두 알림 기준선이라 날짜가 없다)
  return {
    default: real.map((p) => (p.id === "iksan-move-in-household-incentive" ? { ...p, publishedAt: "2026-11-21T01:00:00Z" } : p)),
  };
});

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

  it("새 지원금이 올라왔어요 — 휴대폰 새 정책 알림과 같은 정책, 정책 상세로 (11/20)", async () => {
    vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
    enableLogin(); signInAs("sub-a", { consent: false });
    saveAnswers(익산_대학생);
    render(<NotificationsPage />);
    const added = await screen.findByRole("region", { name: "새 지원금이 올라왔어요" });
    const row = within(added).getByRole("link", { name: /전입세대 전입장려금/ });
    expect(row.getAttribute("href")).toBe("/find/policies/iksan-move-in-household-incentive");
    expect(within(row).getByText(/11월 21일 등록/)).toBeTruthy();
  });

  it("오른쪽 위 ⚙ 는 알림 설정 화면으로 — 내 정보로 보내지 않는다 (11/20 두 단계 구조)", async () => {
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublicKeyForTests");
    enableLogin(); signInAs("sub-a", { consent: false });
    render(<NotificationsPage />);
    const topBar = await screen.findByTestId("top-bar-row");
    expect(within(topBar).getByRole("link", { name: "알림 설정" }).getAttribute("href")).toBe("/notifications/settings");
    expect(document.querySelector('a[href="/account#notifications"]')).toBeNull();
  });
});
