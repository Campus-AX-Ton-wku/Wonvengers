// apps/web/app/__tests__/home.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/redirect", () => ({ goTo: vi.fn(), replacePage: vi.fn(), reloadPage: vi.fn() }));
vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import HomePage from "@/app/home/page";
import { AUTH_KEY, resetAuthForTests, signOut } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { saveAnswers, saveChecklist, saveDocumentChecks, saveLedger, saveListing, saveProfile, saveProfileCard, saveSavedList } from "@/lib/storage";
import policiesJson from "@/data/policies.json";
import { seoulTodayISO, todayISO } from "@/lib/date";
import { addMonths, emptyLedger, ledgerMonth, ledgerPlan, monthKeyOf, toggleLine } from "@/lib/ledger";
import { openPolicies } from "@/lib/home";
import { formatApproxMoney } from "@/lib/money";
import { policiesForRegion } from "@/lib/region";
import { buildCalculationSummary } from "@/lib/summary";
import type { PolicyMeta } from "@/lib/types";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

const 주거급여서류 = (policiesJson as PolicyMeta[]).find((p) => p.id === "youth-housing-benefit-split-payment")?.documents ?? [];

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(replacePage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

const 익산_재직 = { birthDate: birthDateForAge(25), region: "전북특별자치도 익산시" as const, status: "재직" as const, incomeBracket: 1, housingType: "월세" as const };

describe("/home", () => {
  it("로그인 기록이 없으면 온보딩으로 보낸다", async () => {
    enableLogin();
    render(<HomePage />);
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  it("홈을 열어 둔 사이 로그인이 풀리면(만료 · 다른 탭 로그아웃) 온보딩으로 보낸다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    expect(replacePage).not.toHaveBeenCalled();
    act(() => signOut({ redirect: false }));
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  it("다른 탭에서 로그아웃해 로그인 기록이 지워져도 온보딩으로 보낸다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    window.localStorage.removeItem(AUTH_KEY);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: AUTH_KEY })); });
    await vi.waitFor(() => expect(replacePage).toHaveBeenCalledWith("/start"));
  });

  // 11/23 ggue: 홈에서는 조건을 고치지 않는다 — [수정] 버튼을 빼고 조건은 글로만 보여 준다.
  // 조건 수정은 지원금 화면('조건 수정') · 내 정보('내 조건 수정')에 남아 있다.
  it("제목 아래 내 조건은 글로만 — 수정 버튼 · 링크가 없다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("내 주거지원 현황");
    const line = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "25세·익산시·재직");
    expect(line.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: /조건 수정/ })).toBeNull();
    expect(screen.queryByText("수정")).toBeNull();
  });

  it("왼쪽 위 로고는 링크가 아니다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /Perky/ })).toBeNull();
  });

  it("지원 요약 — 지금 신청할 수 있는 수와 [지원금 목록 보기] → 지원금 화면 (미리 보기 줄 · 펼침 없음, 11/21)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const open = openPolicies(policiesJson as PolicyMeta[], 익산_재직, todayISO()) ?? [];
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByText("지금 신청할 수 있는 지원금")).toBeTruthy();
    expect(within(summary).getByTestId("open-count").textContent).toBe(`${open.length}건`);
    expect(within(summary).queryByText(/공고 기준이에요/)).toBeNull();
    // 목록은 지원금 화면이 맡는다 — 홈에는 미리 보기 줄도 펼침 토글도 없다
    expect(within(summary).queryByRole("list")).toBeNull();
    expect(within(summary).queryByRole("button", { name: /목록/ })).toBeNull();
    expect(within(summary).getByRole("link", { name: /지원금 목록 보기/ }).getAttribute("href")).toBe("/find/policies");
    // 계산 권유는 11/20 부터 '오늘 할 일'이 맡는다 — 요약 카드에는 계산 상자도 3D 그림도 없다
    expect(within(summary).queryByRole("link", { name: /계산하기/ })).toBeNull();
    expect(summary.querySelectorAll("img[data-icon3d]")).toHaveLength(0);
  });

  it("답 전이면 시작하기", async () => {
    enableLogin(); signInAs("sub-a");
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByRole("link", { name: "시작하기" }).getAttribute("href")).toBe("/find");
  });

  it("찜한 지원금 목록은 홈에 없다 — 하단 섬 '관심' 탭으로 옮겼다 (11/20)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveSavedList(["youth-housing-benefit-split-payment"]);
    render(<HomePage />);
    await screen.findByRole("region", { name: "내 지원 요약" });
    expect(screen.queryByRole("region", { name: "관심 지원금" })).toBeNull();
    const tabs = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(tabs).getByRole("link", { name: "홈" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "관심" }).getAttribute("href")).toBe("/saved");
  });

  it("홈 인사 — 제목 위 그림 + '익산 사는 직장인님, 반가워요', 누르면 내 정보 · 꾸민 이름이면 그 이름 (11/22 내 프로필)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const first = render(<HomePage />);
    const hello = await screen.findByRole("link", { name: /익산 사는 직장인님, 반가워요/ });
    expect(hello.getAttribute("href")).toBe("/account");
    expect(hello.querySelector("img[data-icon3d='rent']")).not.toBeNull();
    // 인사는 제목보다 위
    const title = screen.getByRole("heading", { level: 1, name: "내 주거지원 현황" });
    expect(hello.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    first.unmount();

    saveProfileCard({ icon: "student", color: "mint", name: "월세 2년 차", pinnedBadge: null });
    render(<HomePage />);
    const named = await screen.findByRole("link", { name: /월세 2년 차님, 반가워요/ });
    expect(named.querySelector("img[data-icon3d='student']")).not.toBeNull();
  });

  it("요약 아래 주거 가이드 세 장 + 체크리스트 — 집 형태(월세)에 맞춰 서류 떼는 곳부터 · 꼬리표, 체크리스트는 맨 끝, 전체 보기는 /guides", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    const guides = await screen.findByRole("region", { name: "주거 가이드" });
    expect(within(guides).getByRole("link", { name: /전체 보기/ }).getAttribute("href")).toBe("/guides");
    const cards = within(guides).getAllByRole("listitem").map((li) => within(li).getByRole("link").getAttribute("href"));
    expect(cards).toEqual(["/guides/where-documents", "/guides/protect-deposit", "/guides/before-contract", "/guides/checklist"]);
    expect(within(within(guides).getAllByRole("listitem")[0]).getByText("월세라면 먼저")).toBeTruthy();
    expect(within(within(guides).getAllByRole("listitem")[1]).queryByText(/라면 먼저/)).toBeNull();
  });

  it("계산이 끝났으면 최종 예상 주거비 상자와 결과 보기, 계산하기는 숨긴다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    const profile = makeProfile();
    saveListing(listing); saveProfile(profile);
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, todayISO());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    // 시안 '홈 · 사용 중'(11/20) — 상자 전체가 결과로 가는 링크 하나, 지원 전 → 지원 후, 줄어든 돈 한 줄
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비, 12개월 기준\. 지원 전 .+, 지원 후 .+\. 결과 보기$/ });
    expect(box.getAttribute("href")).toBe("/result");
    expect(within(box).getByText("12개월 기준")).toBeTruthy();
    // 홈 상자는 천 원 단위(formatApproxMoney) — 정확한 값은 결과 화면 (11/21)
    expect(within(box).getByText(formatApproxMoney(s.nominalTotalCost))).toBeTruthy();
    expect(within(box).getByText(formatApproxMoney(s.finalEstimatedHousingCost)).className).toContain("text-brand-900");
    expect(within(box).getByText(formatApproxMoney(s.nominalTotalCost - s.finalEstimatedHousingCost)).parentElement?.textContent).toMatch(/줄었어요$/);
    expect(box.querySelector('[class*="accent-"]')).toBeNull();
    expect(within(summary).queryByRole("link", { name: "내 월세 계산하기" })).toBeNull();
  });

  it("지금 신청할 수 있는 게 0건이면 '줄었어요'는 빼고 지원 전 → 지원 후만 (0건인데 줄었다는 말이 되지 않게)", async () => {
    enableLogin(); signInAs("sub-a");
    // 만 17세 · 소득 최상위 — 익산에서 지금 신청할 수 있는 게 없다 (11/20 데이터 기준)
    saveAnswers({ ...익산_재직, birthDate: birthDateForAge(17), incomeBracket: 10 });
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    saveListing(listing); saveProfile(makeProfile());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).getByTestId("open-count").textContent).toMatch(/^0/);
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비/ });
    expect(within(box).queryByText(/줄었어요/)).toBeNull();
  });

  it("금액에 넣은 지원이 없어 지원 전 · 후가 같으면 화살표 대신 금액 하나와 '아직 금액에 넣은 지원이 없어요' (11/21)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const listing = makeListing({ region: "전북특별자치도 익산시" });
    const profile = makeProfile({ livesApartFromParents: false });
    saveListing(listing); saveProfile(profile);
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], listing.region), profile, listing, todayISO());
    expect(s.finalEstimatedHousingCost).toBe(s.nominalTotalCost);
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비, 12개월 기준, .+\. 아직 금액에 넣은 지원이 없어요\. 결과 보기$/ });
    expect(within(box).queryByText("지원 전")).toBeNull();
    expect(within(box).getByText("아직 금액에 넣은 지원이 없어요")).toBeTruthy();
    expect(within(box).getByText(formatApproxMoney(s.finalEstimatedHousingCost)).className).toContain("text-brand-900");
  });

  it("연세를 월로 나눠 원 단위가 생기면 홈 상자는 천 원 단위 '약 …' — 숫자 한가운데서 줄이 꺾이지 않게 (11/21)", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    // 연세 160만원 ÷ 12 = 월 133,333원 → 12개월 159만 9,996원 (실제 화면에서 숫자 한가운데서 꺾인 값)
    saveListing(makeListing({ region: "전북특별자치도 익산시", contractType: "연세", rentOrYearlyAmount: 1_600_000, managementFee: 0 }));
    saveProfile(makeProfile());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    const box = within(summary).getByRole("link", { name: /^최종 예상 주거비/ });
    const amounts = within(box).getAllByText(/원$/).filter((el) => el.className.includes("whitespace-nowrap"));
    expect(amounts.length).toBeGreaterThan(0);
    expect(within(box).getAllByText(/^약 \d/).length).toBeGreaterThan(0);
  });

  describe("요약 카드 Perky 포즈", () => {
    const pose = () => document.querySelector("[data-pose]")?.getAttribute("data-pose");

    it("Perky 는 카드 안 오른쪽 위 + 발밑 그림자 — 카드 밖으로 걸치지 않는다 (시안 '홈 보강', 11/21)", async () => {
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      render(<HomePage />);
      const summary = await screen.findByRole("region", { name: "내 지원 요약" });
      const spot = summary.querySelector("[data-perky-spot]") as HTMLElement;
      expect(spot.querySelector("img[data-pose]")).toBeTruthy();
      expect(spot.className).not.toMatch(/-top-/);
      expect(spot.querySelector("[data-perky-shadow]")).toBeTruthy();
    });

    it("신청할 수 있는 게 있으면 found", async () => {
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBe("found");
    });

    it("지금 신청할 수 있는 찜을 모두 준비했으면 success와 그 뜻의 문장", async () => {
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveSavedList(["youth-housing-benefit-split-payment"]);
      saveChecklist("youth-housing-benefit-split-payment", { eligibility: true, period: true, documents: true });
      // 서류 목록이 있는 정책은 홈 카드가 서류만 센다 — 서류를 모두 챙겨야 '준비 끝'
      saveDocumentChecks("youth-housing-benefit-split-payment", 주거급여서류.map((d) => d.name));
      render(<HomePage />);
      const summary = await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBe("success");
      expect(within(summary).getByText("관심 지원금 준비를 마쳤어요.")).toBeTruthy();
    });

    it("답이 없으면 캐릭터를 두지 않는다", async () => {
      enableLogin(); signInAs("sub-a");
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(pose()).toBeUndefined();
    });
  });

  describe("홈 보강 — 오늘 할 일 · 다가오는 일정 (11/20)", () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); });
    afterEach(() => { vi.useRealTimers(); });
    /** 서울 정오 — seoulTodayISO() 가 이 날짜를 돌려준다 */
    const at = (iso: string) => vi.setSystemTime(new Date(`${iso}T03:00:00Z`));

    it("계산 전이면 오늘 할 일이 '계산하기' — 요약보다 위, 3D 계산기, 버튼은 /calculate", async () => {
      at("2026-11-20");
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      render(<HomePage />);
      const todo = await screen.findByRole("region", { name: "오늘 할 일" });
      expect(within(todo).getByText("실제로 내는 돈, 계산해 볼까요?")).toBeTruthy();
      expect(within(todo).getByRole("link", { name: /계산하기/ }).getAttribute("href")).toBe("/calculate");
      expect(todo.querySelector("img[data-icon3d]")?.getAttribute("data-icon3d")).toBe("calculator");
      const summary = screen.getByRole("region", { name: "내 지원 요약" });
      expect(todo.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("관심 지원금 마감 임박 — D-n, 남은 날 · 준비 진행 문장, [이어서 준비하기] → 신청 준비", async () => {
      at("2026-09-25");
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveSavedList(["iksan-youth-rent-support"]);
      saveChecklist("iksan-youth-rent-support", { eligibility: true, period: false, documents: false });
      render(<HomePage />);
      const todo = await screen.findByRole("region", { name: "오늘 할 일" });
      expect(within(todo).getByText("D-5")).toBeTruthy();
      expect(within(todo).getByText("익산형 청년월세 지원사업")).toBeTruthy();
      expect(within(todo).getByText("마감까지 5일 남았어요. 신청 준비 1/3까지 했어요.")).toBeTruthy();
      expect(within(todo).getByRole("link", { name: /이어서 준비하기/ }).getAttribute("href")).toBe("/find/policies/iksan-youth-rent-support/prepare");
    });

    it("할 일이 없으면 블록이 없다 — 계산했고, 급한 일 · 준비 중인 관심 지원금이 없을 때", async () => {
      at("2026-11-20");
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveListing(makeListing({ region: "전북특별자치도 익산시" })); saveProfile(makeProfile());
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(screen.queryByRole("region", { name: "오늘 할 일" })).toBeNull();
    });

    it("답 전(시작하기 카드)에는 오늘 할 일이 없다", async () => {
      at("2026-11-20");
      enableLogin(); signInAs("sub-a");
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(screen.queryByRole("region", { name: "오늘 할 일" })).toBeNull();
    });

    it("관심 지원금 신청 시작이 14일 안이면 다가오는 일정 — 날짜 · 신청 시작 · 상세 링크, 알림함 링크", async () => {
      at("2026-04-05");
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveListing(makeListing({ region: "전북특별자치도 익산시" })); saveProfile(makeProfile());
      saveSavedList(["iksan-youth-rent-support"]);
      render(<HomePage />);
      const schedule = await screen.findByRole("region", { name: "다가오는 일정" });
      const row = within(schedule).getByRole("link", { name: /익산형 청년월세 지원사업/ });
      expect(row.getAttribute("href")).toBe("/find/policies/iksan-youth-rent-support");
      expect(within(row).getByText("4.15")).toBeTruthy();
      expect(within(row).getByText("수요일")).toBeTruthy();
      expect(within(row).getByText("신청 시작")).toBeTruthy();
      expect(within(schedule).getByRole("link", { name: /알림함/ }).getAttribute("href")).toBe("/notifications");
      // 오늘 할 일은 새로 열린 청년월세(3/30) — 일정의 익산형과 겹치지 않는다. 블록 순서: 요약 → 일정
      const todo = screen.getByRole("region", { name: "오늘 할 일" });
      expect(within(todo).getByText("청년월세 지원 (2026년 상시사업 전환)")).toBeTruthy();
      const summary = screen.getByRole("region", { name: "내 지원 요약" });
      expect(summary.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("오늘 할 일에 오른 정책은 일정에서 빠진다 — 남는 게 없으면 블록째 숨김", async () => {
      at("2026-09-25"); // 익산형 청년월세 9/30 마감 — 할 일(D-5)에 오른다
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveSavedList(["iksan-youth-rent-support"]);
      render(<HomePage />);
      await screen.findByRole("region", { name: "오늘 할 일" });
      expect(screen.queryByRole("region", { name: "다가오는 일정" })).toBeNull();
    });

    it("11/20 데이터(마감 4 · 상시 4)는 14일 안 일정이 없다 — 블록을 숨긴다", async () => {
      at("2026-11-20");
      enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
      saveSavedList(["youth-housing-benefit-split-payment", "moland-youth-rent-support"]);
      render(<HomePage />);
      await screen.findByRole("region", { name: "내 지원 요약" });
      expect(screen.queryByRole("region", { name: "다가오는 일정" })).toBeNull();
    });
  });
});

describe("/home — 주거비 달력 입구 한 줄 (11/21)", () => {
  const thisMonth = monthKeyOf(seoulTodayISO());
  const 이번달시작 = makeListing({ region: "전북특별자치도 익산시", contractType: "월세", rentOrYearlyAmount: 400_000, managementFee: 50_000, contractStartDate: `${thisMonth}-01`, months: 12 });

  it("주거비 상자 아래 '이번 달 주거비 · 낸 돈 1/2 …' → /ledger", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveListing(이번달시작); saveProfile(makeProfile());
    saveLedger(toggleLine(emptyLedger(), thisMonth, "rent", 400_000));
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    const row = within(summary).getByRole("link", { name: /^이번 달 주거비, 낸 돈 2개 중 1개/ });
    expect(row.getAttribute("href")).toBe("/ledger");
    expect(within(row).getByText(/^낸 돈 1\/2/)).toBeTruthy();
  });

  it("연세 + 관리비 0원, 계약 2개월째 이후 — '낸 돈 0/0' 대신 낸 돈 부분을 뺀다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveListing(makeListing({ region: "전북특별자치도 익산시", contractType: "연세", rentOrYearlyAmount: 4_800_000, managementFee: 0, contractStartDate: `${addMonths(thisMonth, -2)}-01`, months: 12 }));
    saveProfile(makeProfile());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    const row = within(summary).getByRole("link", { name: /^이번 달 주거비/ });
    expect(row.textContent).not.toContain("낸 돈");
    expect(row.getAttribute("aria-label")).not.toContain("낸 돈");
  });

  it("이번 달 칸을 다 누르면 초록 '이번 달 다 적었어요'", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    const profile = makeProfile();
    saveListing(이번달시작); saveProfile(profile);
    // 이번 달 칸을 화면과 같은 함수로 만들어 전부 누른다 — 들어오는 지원이 몇 건이든(데이터에 따라) 결과가 같다
    const s = buildCalculationSummary(policiesForRegion(policiesJson as PolicyMeta[], 이번달시작.region), profile, 이번달시작, seoulTodayISO());
    let record = emptyLedger();
    for (const line of ledgerMonth(ledgerPlan(이번달시작, s, profile.birthDate), record, thisMonth).lines) record = toggleLine(record, thisMonth, line.key, line.amount);
    saveLedger(record);
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    const row = within(summary).getByRole("link", { name: /^이번 달 주거비, 이번 달 다 적었어요/ });
    expect(within(row).getByText("이번 달 다 적었어요").className).toContain("text-ok-700");
  });

  it("이번 달이 계약 기간 밖이면 한 줄이 없다", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    saveListing({ ...이번달시작, contractStartDate: `${addMonths(thisMonth, 1)}-01` }); saveProfile(makeProfile());
    render(<HomePage />);
    const summary = await screen.findByRole("region", { name: "내 지원 요약" });
    expect(within(summary).queryByRole("link", { name: /^이번 달 주거비/ })).toBeNull();
  });
});

describe("/home — 대출 · 보증 (11/22)", () => {
  it("주거 가이드 아래에 세 장 (11/22 순서 바꿈) — 월세면 보증부월세대출부터 · 꼬리표, 카드는 상세로, 전체 보기는 /loans", async () => {
    enableLogin(); signInAs("sub-a"); saveAnswers(익산_재직);
    render(<HomePage />);
    const loans = await screen.findByRole("region", { name: "대출 · 보증" });
    const cards = within(loans).getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/loans/"));
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute("href")).toBe("/loans/youth-btm-monthly-rent-loan");
    expect(within(cards[0]).getByText("월세라면 먼저")).toBeTruthy();
    expect(within(loans).getByRole("link", { name: /전체 보기/ }).getAttribute("href")).toBe("/loans");
    const guides = screen.getByRole("region", { name: "주거 가이드" });
    expect(guides.compareDocumentPosition(loans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
