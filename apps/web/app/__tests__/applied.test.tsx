// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import SavedPage from "@/app/saved/page";
import FindPoliciesPage from "@/app/find/policies/page";
import { AppliedButton } from "@/app/components";
import { resetAuthForTests } from "@/lib/auth";
import { appliedDayLabel, appliedIds, notApplied, notAppliedIds } from "@/lib/applied";
import { inboxItems } from "@/lib/inbox";
import policiesJson from "@/data/policies.json";
import { loadApplied, resetAllAnswers, saveAnswers, saveSavedList, setApplied } from "@/lib/storage";
import { CONSENT_VERSION, MAX_APPLIED, emptyContent, validateUserData } from "@/lib/user-data";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

/**
 * 신청 완료 (11/23 ggue) — '신청을 마쳤어요'로 표시하면 추천에서 빠지고 관심 탭 '신청 완료'에 모인다.
 * 서버 마감 알림에서 빠지는 것은 apps/api/test/notifier-run.test.ts.
 */

const policies = policiesJson as PolicyMeta[];
const 주거급여 = "youth-housing-benefit-split-payment";
const 전입장려금 = "iksan-move-in-household-incentive";
const 익산_대학생 = { birthDate: birthDateForAge(23), region: "전북특별자치도 익산시" as const, status: "대학생" as const, incomeBracket: 1, housingType: "월세" as const };

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("기록 · 거르기", () => {
  it("표시하면 날짜와 함께 남고, 취소하면 지운다", () => {
    setApplied(주거급여, "2026-11-23");
    setApplied(전입장려금, "2026-11-20");
    expect(loadApplied()).toEqual({ [주거급여]: "2026-11-23", [전입장려금]: "2026-11-20" });
    setApplied(주거급여, null);
    expect(loadApplied()).toEqual({ [전입장려금]: "2026-11-20" });
  });

  it("거르기 · 최근 표시 순 · 날짜 글씨", () => {
    const applied = { a: "2026-11-20", b: "2026-11-23" };
    expect(notApplied([{ id: "a" }, { id: "c" }], applied)).toEqual([{ id: "c" }]);
    expect(notAppliedIds(["a", "b", "c"], applied)).toEqual(["c"]);
    expect(appliedIds(applied)).toEqual(["b", "a"]);
    expect(appliedDayLabel("2026-11-03")).toBe("11월 3일");
  });

  it("'처음부터 다시'에도 남는다 — 답이 아니라 한 일의 기록이다", () => {
    saveAnswers(익산_대학생);
    setApplied(주거급여, "2026-11-23");
    resetAllAnswers();
    expect(loadApplied()).toEqual({ [주거급여]: "2026-11-23" });
  });

  it("계정 저장 형식 — 없어도 되고(예전 저장), 정책 id · 날짜만, 100개까지", () => {
    const base = { schemaVersion: 1, consentVersion: CONSENT_VERSION, consentAt: "2026-11-23T00:00:00.000Z", ...emptyContent() };
    const { applied: _a, ...old } = base;
    const r = validateUserData(old);
    expect(r.ok && r.value.applied).toEqual({});
    expect(validateUserData({ ...base, applied: { [주거급여]: "2026-11-23" } }).ok).toBe(true);
    expect(validateUserData({ ...base, applied: { [주거급여]: "어제" } })).toEqual({ ok: false, error: `data.applied.${주거급여}: not a date` });
    expect(validateUserData({ ...base, applied: { "Bad Id": "2026-11-23" } }).ok).toBe(false);
    const many = Object.fromEntries(Array.from({ length: MAX_APPLIED + 1 }, (_, i) => [`p-${i}`, "2026-11-23"]));
    expect(validateUserData({ ...base, applied: many }).ok).toBe(false);
  });

  it("알림함 — 신청 완료는 마감 · 새 지원금 · 새로 열린 지원금에서 빠진다", () => {
    const read = { checklist: () => ({ eligibility: false, period: false, documents: false }), documents: () => [] };
    const applied = { [주거급여]: "2026-11-23" };
    const items = inboxItems(notApplied(policies, applied), 익산_대학생, notAppliedIds([주거급여], applied), "2026-11-23", read);
    expect(items.map((i) => i.policy.id)).not.toContain(주거급여);
  });
});

describe("[신청을 마쳤어요] 버튼", () => {
  it("누르면 '신청 완료 · 오늘'로 바뀌고 [취소]로 되돌린다", async () => {
    const user = userEvent.setup();
    render(<AppliedButton policyId={주거급여} policyName="청년 주거급여 분리지급" />);
    await user.click(await screen.findByRole("button", { name: "신청을 마쳤어요" }));
    expect(screen.getByText(/^신청 완료 · \d+월 \d+일$/)).toBeTruthy();
    expect(Object.keys(loadApplied())).toEqual([주거급여]);
    await user.click(screen.getByRole("button", { name: "청년 주거급여 분리지급 신청 완료 표시 취소" }));
    expect(loadApplied()).toEqual({});
    expect(screen.getByRole("button", { name: "신청을 마쳤어요" })).toBeTruthy();
  });
});

describe("관심 탭 — 신청 완료 보기", () => {
  function 열기(search = "") {
    enableLogin();
    signInAs("sub-a");
    saveAnswers(익산_대학생);
    window.history.replaceState(null, "", `/saved${search}`);
    render(<SavedPage />);
  }

  it("보기가 전체 · 신청 준비 중 · 신청 완료 세 칸 — 신청 완료는 전체에서 빠지고 따로 모인다", async () => {
    saveSavedList([주거급여, 전입장려금]);
    setApplied(주거급여, "2026-11-23");
    열기();
    const tabs = await screen.findByRole("group", { name: "보기" });
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual(["전체1", "신청 준비 중0", "신청 완료1"]);
    const all = screen.getByRole("region", { name: "관심 지원금" });
    expect(within(all).queryByText("청년 주거급여 분리지급")).toBeNull();

    await userEvent.click(within(tabs).getByRole("button", { name: /신청 완료/ }));
    expect(window.location.search).toBe("?view=applied");
    const done = screen.getByRole("region", { name: "신청 완료" });
    expect(within(done).getByText("청년 주거급여 분리지급")).toBeTruthy();
    expect(within(done).getByText("11월 23일 신청")).toBeTruthy();
    expect(within(done).getByRole("link", { name: /공식 사이트에서 결과 확인하기/ }).getAttribute("target")).toBe("_blank");
    expect(within(done).getByRole("link", { name: /^11월 23일 신청/ }).getAttribute("href")).toBe(`/find/policies/${주거급여}`);
  });

  it("관심(♡)을 안 눌렀어도 신청 완료로 표시했으면 모인다", async () => {
    setApplied(전입장려금, "2026-11-22");
    열기("?view=applied");
    const done = await screen.findByRole("region", { name: "신청 완료" });
    expect(within(done).getByText("전입세대 전입장려금")).toBeTruthy();
  });

  it("관심 지원금을 모두 신청했으면 '전체'에 안내와 [신청 완료 보기]", async () => {
    saveSavedList([주거급여]);
    setApplied(주거급여, "2026-11-23");
    열기();
    expect(await screen.findByText("관심 지원금을 모두 신청했어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "신청 완료 보기" })).toBeTruthy();
  });

  it("신청 완료가 비었을 때 안내", async () => {
    saveSavedList([주거급여]);
    열기("?view=applied");
    expect(await screen.findByText("아직 신청을 마친 지원금이 없어요")).toBeTruthy();
  });
});

describe("지원금 탭 — 신청 완료는 목록에서 빠진다", () => {
  it("익산 대학생 신청 가능 3개 중 하나를 신청 완료로 표시하면 2개", async () => {
    saveAnswers(익산_대학생);
    setApplied(주거급여, "2026-11-23");
    render(<FindPoliciesPage />);
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("받을 수 있는 주거 혜택 2개");
    expect(screen.queryByText("청년 주거급여 분리지급")).toBeNull();
  });
});
