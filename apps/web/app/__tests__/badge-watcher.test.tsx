// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import { BadgeWatcher } from "@/app/components/BadgeWatcher";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { saveRemote } from "@/lib/remote";
import {
  badgesSeen, clearDeviceRecords, homeReachedBy, loadBadges, loadProfileCard, markBadgesSeen, markGuideRead, markHomeReached,
  saveListing, saveProfile, saveSavedList,
} from "@/lib/storage";
import { resetSyncForTests } from "@/lib/sync";
import type { PolicyMeta } from "@/lib/types";
import { enableLogin, seedSyncMeta, signInAs } from "@/lib/__tests__/auth-fixtures";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";

/** 배지 받는 순간 (내 프로필 설계 §7) — 로그인 · 처음 동기화 뒤에만, 처음 판정은 조용히, 그 뒤 새 배지 하나만 창 */

const [first, second] = (policiesJson as PolicyMeta[]).map((p) => p.id);

beforeEach(() => {
  window.localStorage.clear();
  resetSyncForTests();
  resetAuthForTests();
  vi.mocked(saveRemote).mockResolvedValue({ ok: true, updatedAt: "2026-11-22T09:00:00.000Z" });
});
afterEach(() => {
  resetSyncForTests();
  vi.unstubAllEnvs();
});

/** 로그인 · 처음 동기화 끝 — 아직 홈에는 안 들어옴 */
function 로그인만() {
  enableLogin();
  signInAs("sub-a");
  seedSyncMeta("sub-a");
}

function 로그인() {
  로그인만();
  markHomeReached("sub-a");
}

describe("BadgeWatcher", () => {
  it("로그인하고 홈에 들어오기 전에는 판정하지 않는다 — 홈에 들어오는 순간 판정 (11/23 ggue)", async () => {
    로그인만();
    markBadgesSeen(); // 예전에 이 기기에서 판정한 적이 있어도
    saveSavedList([first]); // 로그인 전 질문 · 목록에서 하트를 눌러 둔 상태
    render(<BadgeWatcher />);
    expect(loadBadges()).toEqual({});
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => markHomeReached("sub-a"));
    expect(Object.keys(loadBadges())).toEqual(["first_save"]);
    expect(await screen.findByRole("dialog", { name: /‘첫 관심’ 배지를 받았어요/ })).toBeTruthy();
  });

  it("홈에 들어온 기록은 계정마다 — 다른 계정이면 다시 홈을 기다리고, 로그아웃하면 지운다", () => {
    markHomeReached("sub-a");
    expect(homeReachedBy("sub-a")).toBe(true);
    expect(homeReachedBy("sub-b")).toBe(false);
    expect(homeReachedBy(null)).toBe(false);
    clearDeviceRecords();
    expect(homeReachedBy("sub-a")).toBe(false);
  });

  it("이 기기에서 처음 판정할 때는 창 없이 기록만 — 이미 해 둔 것도 받은 날이 생긴다", () => {
    로그인();
    saveSavedList([first]);
    render(<BadgeWatcher />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(Object.keys(loadBadges())).toEqual(["first_save"]);
    expect(badgesSeen()).toBe(true);
  });

  it("그 뒤 조건을 채우면 그 화면에서 창 — '첫 계산' 배지를 받았어요 · 다음 배지 · [대표 배지로 걸기]", async () => {
    로그인();
    markBadgesSeen();
    render(<BadgeWatcher />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      saveListing(makeListing());
      saveProfile(makeProfile());
    });
    const sheet = await screen.findByRole("dialog", { name: "‘첫 계산’ 배지를 받았어요" });
    expect(within(sheet).getByText(/내 월세를 처음 계산했어요/)).toBeTruthy();
    expect(within(sheet).getByText(/다음 배지 ‘첫 관심’/)).toBeTruthy();
    expect(loadBadges().first_calc).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await userEvent.setup().click(within(sheet).getByRole("button", { name: "대표 배지로 걸기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(loadProfileCard()?.pinnedBadge).toBe("first_calc");
  });

  it("한꺼번에 여러 개면 창은 하나 — 나머지는 조용히 기록", async () => {
    로그인();
    markBadgesSeen();
    render(<BadgeWatcher />);
    act(() => saveSavedList([first, second]));
    await screen.findByRole("dialog", { name: "‘첫 관심’ 배지를 받았어요" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    act(() => markGuideRead("before-contract"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("로그인 전이거나 처음 동기화 전이면 아무것도 적지 않는다 — 충돌 창이 뜨지 않게", () => {
    saveSavedList([first]);
    const guest = render(<BadgeWatcher />);
    expect(loadBadges()).toEqual({});
    guest.unmount();

    enableLogin();
    signInAs("sub-a"); // 처음 동기화 기록 없음
    render(<BadgeWatcher />);
    expect(loadBadges()).toEqual({});
  });
});
