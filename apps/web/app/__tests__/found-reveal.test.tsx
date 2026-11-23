// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import ResultPage from "@/app/result/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { markReveal, takeReveal } from "@/lib/reveal";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";

/**
 * 결과 화면 앞 '찾았어요' 한 장 (11/23 시안 '찾았어요 화면 설계').
 * 판정 질문의 [결과 확인하기] 직후 한 번 — 파란 막에 Perky · 개수 · 둘째 줄, 2.8초 뒤 저절로 결과 화면.
 */

const 찾았어요 = () => screen.queryByText(/^받을 수 있는 혜택 \d+가지를 찾았어요$/);

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  saveListing(makeListing({ contractType: "월세", rentOrYearlyAmount: 400_000 }));
  saveProfile(makeProfile());
});
afterEach(() => vi.useRealTimers());

describe("결과 화면 앞 '찾았어요'", () => {
  it("표시가 있으면 먼저 덮고, 2.4초에 결과를 밑에 깔고, 2.8초에 걷힌다 — 결과 제목에 초점", () => {
    markReveal();
    render(<ResultPage />);

    expect(찾았어요()).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    act(() => vi.advanceTimersByTime(2400));
    const title = screen.getByRole("heading", { level: 1 });
    expect(찾았어요()).toBeTruthy(); // 아직 걷히는 중

    act(() => vi.advanceTimersByTime(400));
    expect(찾았어요()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("heading", { level: 1 })).toBe(title); // 다시 마운트하지 않는다
  });

  it("개수는 결과 화면의 지원 카드 수 — 합계에 넣은 지원 + 더 받을 수 있는 지원 전부", () => {
    markReveal();
    render(<ResultPage />);
    const count = Number(찾았어요()!.textContent!.match(/(\d+)가지/)![1]);
    // 숫자 기둥은 0부터 그 수까지
    expect(screen.getByTestId("reveal-digits").children).toHaveLength(count + 1);

    act(() => vi.advanceTimersByTime(2800));
    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    const total = sections
      .filter((t) => /^(위 금액에 넣은 지원|조건이 맞으면 더 받을 수 있는 지원) \d+개$/.test(t))
      .reduce((sum, t) => sum + Number(t.match(/(\d+)개$/)![1]), 0);
    expect(count).toBe(total);
    expect(count).toBeGreaterThan(0);
  });

  it("둘째 줄은 결과 제목과 같은 기준 — 지원 이름 · 금액은 넣지 않는다", () => {
    markReveal();
    render(<ResultPage />);
    const 막 = 찾았어요()!.closest("[role=status]") as HTMLElement;
    expect(막.textContent).toMatch(/지금 바로 신청할 수 있어요|조건을 확인하면 받을 수 있어요|마감이 가까운 혜택이 있어요/);
    expect(막.textContent).not.toMatch(/원/);
  });

  it("표시가 없으면(홈 · 지원금 탭의 '계산 결과 보기', 새로고침) 바로 결과 화면이다", () => {
    render(<ResultPage />);
    expect(찾았어요()).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("한 번 꺼내면 지운다 — 다시 열면(뒤로 가기 · 새로고침) 안 나온다", () => {
    markReveal();
    const first = render(<ResultPage />);
    expect(찾았어요()).toBeTruthy();
    first.unmount();

    render(<ResultPage />);
    expect(찾았어요()).toBeNull();
    expect(takeReveal()).toBe(false);
  });

  it("받을 수 있는 게 없으면 막 없이 빈 화면이 바로 나오고, 표시도 남기지 않는다", () => {
    // 전주시 · 60세 — 전국 지원은 나이로, 익산 지원은 지역으로 빠져 카드가 0장이다
    saveListing(makeListing({ region: "전북특별자치도 전주시", contractType: "월세", rentOrYearlyAmount: 400_000 }));
    saveProfile(makeProfile({ birthDate: "1960-01-01" }));
    markReveal();
    render(<ResultPage />);

    expect(찾았어요()).toBeNull();
    expect(screen.getByText("조건에 맞는 혜택을 찾지 못했어요")).toBeTruthy();
    expect(window.sessionStorage.getItem("perky.reveal")).toBeNull();
  });

  it("동작 줄이기면 다 나온 모습으로 1.5초 보이고 바로 넘어간다", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      markReveal();
      render(<ResultPage />);
      act(() => vi.advanceTimersByTime(1499));
      expect(찾았어요()).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(찾았어요()).toBeNull();
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });
});
