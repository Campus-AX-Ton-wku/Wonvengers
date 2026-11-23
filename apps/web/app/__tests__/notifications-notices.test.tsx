// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
const fx = vi.hoisted(() => {
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const day = (k: number) => new Date(Date.parse(today) + k * 86_400_000).toISOString().slice(0, 10);
  return { snapshot: { generatedAt: null, notices: [{ id: "n1", source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택",
    title: "익산 행복주택 추가모집", supplier: "LH", announcedAt: day(-2), applyStart: day(-2), applyEnd: day(20), url: "https://apply.lh.or.kr/x", address: null }] } };
});
vi.mock("@/data/notices.json", () => ({ default: fx.snapshot }));

import NotificationsPage from "@/app/notifications/page";
import { resetAuthForTests } from "@/lib/auth";
import { loadInboxSeen } from "@/lib/inbox";
import { saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  enableLogin(); signInAs("sub-a");
});
afterEach(() => vi.unstubAllEnvs());

describe("/notifications — 새 청약 공고 (11/22)", () => {
  it("익산에 사는 사람에게 '새 청약 공고가 올라왔어요' 한 줄 → 공고 상세, 보면 읽음", async () => {
    saveAnswers({ birthDate: birthDateForAge(25), region: "전북특별자치도 익산시", status: "재직", incomeBracket: 1, housingType: "월세" });
    render(<NotificationsPage />);
    const section = await screen.findByRole("region", { name: "새 청약 공고가 올라왔어요" });
    const link = within(section).getByRole("link", { name: /익산 행복주택 추가모집/ });
    expect(link.getAttribute("href")).toBe("/housing/notice?id=n1");
    expect(within(section).getByText("새 소식")).toBeTruthy();
    expect(loadInboxSeen().has("notice:n1")).toBe(true);
  });

  it("사는 곳을 답하지 않았으면 없다", async () => {
    render(<NotificationsPage />);
    await screen.findByRole("heading", { level: 1, name: "알림" });
    expect(screen.queryByRole("region", { name: "새 청약 공고가 올라왔어요" })).toBeNull();
  });
});
