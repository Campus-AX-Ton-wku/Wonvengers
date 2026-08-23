// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultPage from "@/app/result/page";
import ResultSummaryPage from "@/app/result/summary/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => {
  // 렌더마다 새 객체를 주면 router 를 의존성으로 쓰는 useEffect 가 무한히 다시 돈다.
  // 실제 next/navigation 의 useRouter 는 컨텍스트에서 같은 객체를 준다.
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});

/**
 * QA체크리스트 "캡처용 요약" 절을 자동화한 것.
 *
 * 가장 중요한 항목은 "두 금액이 결과 상세 화면의 금액과 정확히 같다" 다 — 캡처한
 * 요약과 상세가 다른 숫자를 말하면 그게 제일 나쁜 결과다.
 */

/**
 * 오늘 기준으로 접수가 열려 있는 정책만 조합에 들어간다 (국토부·전북은 접수 종료).
 * 이사비는 일시 지출이 0이면 금액이 0이라 조합에 들어가지 않으므로 값을 넣어 둔다.
 */
function seed(
  listingOverrides: Parameters<typeof makeListing>[0] = {},
  profileOverrides: Parameters<typeof makeProfile>[0] = {}
) {
  saveListing(
    makeListing({
      contractType: "월세",
      rentOrYearlyAmount: 350000,
      months: 12,
      oneTimeMoveCost: 300000,
      ...listingOverrides,
    })
  );
  saveProfile(makeProfile(profileOverrides));
}

/** 화면에서 "1,234,567원" 꼴 금액만 뽑는다. */
function amountsOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".tabular-nums")).map(
    (el) => el.textContent?.trim() ?? ""
  );
}

describe("/result/summary", () => {
  it("두 금액이 결과 상세 화면의 금액과 정확히 같다", async () => {
    seed();

    const detail = render(<ResultPage />);
    await screen.findByRole("heading", { level: 1 });
    const detailAmounts = amountsOf(detail.container);
    detail.unmount();

    const summary = render(<ResultSummaryPage />);
    await screen.findByText("Perky");
    const summaryAmounts = amountsOf(summary.container);

    // 두 화면 모두 최대 지원 가능액 · 최종 예상 주거비를 앞의 두 값으로 보여준다
    expect(summaryAmounts.slice(0, 2)).toEqual(detailAmounts.slice(0, 2));
    expect(summaryAmounts[0]).toMatch(/^[\d,]+원$/);
  });

  it("기준일과 워드마크를 보여준다 (캡처가 돌아다녀도 출처와 시점을 알 수 있게)", async () => {
    seed();
    render(<ResultSummaryPage />);

    expect(await screen.findByText("Perky")).toBeTruthy();
    expect(screen.getByText(/\d{4}-\d{2}-\d{2} 기준/)).toBeTruthy();
  });

  it("조합에 들어간 정책을 금액과 함께 나열한다", async () => {
    seed();
    render(<ResultSummaryPage />);
    await screen.findByText("Perky");

    expect(screen.getByText("익산시 전입 청년 이사비·중개보수 지원사업")).toBeTruthy();
  });

  it("미확인 조건이 있으면 건수를 알려준다", async () => {
    // 주거급여 분리지급은 원가구 소득으로 심사한다. 모름으로 두면 조건충족시가능이
    // 되고, 금액이 가장 커서 조합에 들어간다 → 미확인 조건이 금액에 포함된다 (F4-8).
    seed({}, { originHouseholdMonthlyIncome: "unknown" });

    render(<ResultSummaryPage />);
    await screen.findByText("Perky");
    expect(screen.getByText(/아직 확인되지 않은 조건 \d+건이 이 금액에 포함되어 있습니다/)).toBeTruthy();
  });

  it("예시 매물로 계산했으면 실제 매물이 아니라고 표시한다", async () => {
    seed({ exampleId: "iksan-oneroom-monthly" });

    render(<ResultSummaryPage />);
    await screen.findByText("Perky");
    expect(screen.getByText(/가상 예시 · 실제 매물이 아닙니다/)).toBeTruthy();
  });

  it("자격 확정이 아니라는 고지를 담는다", async () => {
    seed();
    render(<ResultSummaryPage />);
    await screen.findByText("Perky");

    expect(screen.getByText(/신청 자격을 확정하는 것이 아니며/)).toBeTruthy();
  });

  it("결과 상세로 돌아가는 링크가 있다", async () => {
    seed();
    render(<ResultSummaryPage />);
    await screen.findByText("Perky");

    expect(screen.getByRole("link", { name: "결과 상세로 돌아가기" }).getAttribute("href")).toBe(
      "/result"
    );
  });
});

describe("/result 요약 진입", () => {
  it("결과 화면에서 요약 화면으로 가는 링크가 있다", async () => {
    seed();
    render(<ResultPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.getByRole("link", { name: /한 화면 요약 보기/ }).getAttribute("href")
    ).toBe("/result/summary");
  });
});
