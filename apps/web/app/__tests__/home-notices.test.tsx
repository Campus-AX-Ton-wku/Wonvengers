// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));
const fx = vi.hoisted(() => ({ snapshot: { generatedAt: null as string | null, notices: [] as unknown[] } }));
vi.mock("@/data/notices.json", () => ({ default: fx.snapshot }));

import HomePage from "@/app/home/page";
import { resetAuthForTests } from "@/lib/auth";
import { saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(today) + n * 86_400_000).toISOString().slice(0, 10);
const notice = (id: string) => ({ id, source: "마이홈포털", kind: "공공임대", typeLabel: "행복주택", title: id, supplier: "LH",
  announcedAt: day(-1), applyStart: day(-1), applyEnd: day(9), url: "https://apply.lh.or.kr/x", address: null });

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  enableLogin(); signInAs("sub-a");
  saveAnswers({ birthDate: birthDateForAge(25), region: "전북특별자치도 익산시", status: "재직", incomeBracket: 1, housingType: "월세" });
});
afterEach(() => vi.unstubAllEnvs());

describe("/home — 익산 청약 공고 (11/22)", () => {
  it("주거 가이드 위에 최대 3장 + 전체 보기(/housing)", async () => {
    fx.snapshot.notices = ["가", "나", "다", "라"].map(notice);
    render(<HomePage />);
    const row = await screen.findByRole("region", { name: "익산 청약 공고" });
    expect(within(row).getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("https://"))).toHaveLength(3);
    expect(within(row).getByRole("link", { name: /전체 보기/ }).getAttribute("href")).toBe("/housing");
    const guides = screen.getByRole("region", { name: "주거 가이드" });
    expect(row.compareDocumentPosition(guides) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("공고가 없으면 칸째 숨긴다", async () => {
    fx.snapshot.notices = [];
    render(<HomePage />);
    await screen.findByRole("region", { name: "주거 가이드" });
    expect(screen.queryByRole("region", { name: "익산 청약 공고" })).toBeNull();
  });
});
