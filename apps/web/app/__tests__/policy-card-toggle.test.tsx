// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ResultPage from "@/app/result/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import policies from "@/data/policies.json";
import loanProducts from "@/data/loan-products.json";

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});

/**
 * 2층 결과 화면의 정책 카드 접기.
 *
 * jsdom 은 레이아웃을 하지 않아 "보이는지"를 직접 물을 수 없다. 대신 요구사항을
 * 구조로 확인한다 — 세부 내용은 닫힌 <details> 안에 있어야 하고, 항상 보여야 하는
 * 것(신청 링크·금액·태그)은 카드 안의 <details> 밖에 있어야 한다.
 *
 * 주의: '대상아님' 그룹 자체가 <details> 라서, 그 안의 카드는 무엇이든 details
 * 안에 있다. 카드 단위로 좁혀서 본다.
 *
 * 1층 카드에는 토글이 없다. 공고 문구·요건·출처는 상세 화면으로 내려갔다
 * (app/find/PolicyCard.tsx, app/__tests__/find-policy-detail.test.tsx).
 */

/** 결과 화면 맨 위(대상아님 그룹 밖)의 정책 카드들 */
function topCards(): HTMLElement[] {
  return screen.getAllByRole("article").filter((card) => card.closest("details") === null);
}

function 상세_토글(container: HTMLElement, text: string | RegExp): HTMLDetailsElement {
  const node = within(container).getByText(text);
  const details = node.closest("details") as HTMLDetailsElement | null;
  expect(details, `"${text}" 가 카드 안 토글에 들어 있지 않다`).not.toBeNull();
  return details!;
}

describe("2층 정책 카드", () => {
  async function renderResult() {
    saveListing(
      makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12, oneTimeMoveCost: 300000 })
    );
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByRole("heading", { level: 1 });
  }

  it("요건 목록(충족·미충족·확인 필요)은 닫힌 토글 안에 있다", async () => {
    await renderResult();
    const resultItem = topCards()[0].closest(".stagger-in") as HTMLElement;
    const details = 상세_토글(resultItem, "충족");
    expect(details.open).toBe(false);
  });

  it("요건과 계산식은 카드 안의 토글 하나에 함께 있다 (11/17 — 카드 밖 별도 상자를 없앰)", async () => {
    await renderResult();
    const card = topCards()[0];
    expect(card.querySelectorAll("details")).toHaveLength(1);
    expect(within(card).getByText("요건과 계산 방법 보기")).toBeTruthy();
    expect(within(card).getByText(/× \d+개월|예상액/).closest("details")).not.toBeNull();
  });

  it("원문 대조일은 토글 없이 출처 줄에 바로 보인다 — '검수 상태' 토글은 두지 않는다 (11/17)", async () => {
    await renderResult();
    // 익산 이사비는 2026-05-14 예산 소진 마감(2026-11-03 원문 재대조)이라 맨 위 카드가 아니다 — 상시인 분리지급으로 본다.
    const title = screen.getByRole("heading", { name: /청년 주거급여 분리지급/ });
    const card = title.closest("article")!;
    expect(card, "청년 주거급여 분리지급 카드를 찾지 못했다").toBeTruthy();

    const source = within(card).getByRole("link", { name: /공식 출처 새 창에서 열기/ });
    expect(source.textContent).toMatch(/\d{4}\.\d{2}\.\d{2} 대조|원문 확인 필요/);
    expect(source.closest("details")).toBeNull();
    expect(within(card).queryByText("검수 상태")).toBeNull();
    const details = 상세_토글(card, /2026년 공고 기준/);
    expect(details.open).toBe(false);
  });

  it("내부 검수 메모(notes)는 정책·대출 어디에도 그리지 않는다", async () => {
    await renderResult();
    const text = document.body.textContent ?? "";
    const items = [...policies, ...loanProducts] as { id: string; notes: string }[];
    for (const item of items) {
      if (!item.notes) continue;
      expect(text.includes(item.notes), `${item.id} 의 notes 가 화면에 노출됐다`).toBe(false);
    }
    expect(screen.queryByText("검수 상태 · 참고사항")).toBeNull();
  });

  it("대출 카드의 확인 날짜는 정책 카드와 같은 점 표기다", async () => {
    // 익산 청년 전세자금 대출이자 지원으로 본다. 확인일은 DB(검수 기록)에서 오므로 데이터 값을 그대로 쓴다.
    const verifiedAt = loanProducts.find((x) => x.id === "iksan-youth-jeonse-loan-interest")!.verifiedAt!;
    saveListing(makeListing({ region: "전북특별자치도 익산시", contractType: "월세", rentOrYearlyAmount: 350000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByRole("heading", { level: 1 });
    const loan = screen.getByText("청년 전세자금 대출이자 지원사업", { selector: "p" }).parentElement!;
    expect(within(loan).getByText(new RegExp(`${verifiedAt.replace(/-/g, "\\.")} 확인`))).toBeTruthy();
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2} 확인/)).toBeNull();
  });

  it("상태·금액·준비 CTA·공식 신청 링크는 토글 밖에 남는다", async () => {
    await renderResult();
    const card = topCards()[0];

    expect(within(card).getByText(/^(예상적용|조건충족시가능)$/).closest("details")).toBeNull();
    expect(within(card).getByText(/받을 수 있는 예상 금액/).closest("details")).toBeNull();
    expect(within(card).getByRole("link", { name: /신청 준비 시작하기|마감 전 신청 준비하기/ }).closest("details")).toBeNull();
    expect(within(card).getByRole("link", { name: /공식 출처 새 창에서 열기/ }).closest("details")).toBeNull();
    expect((within(card).getByText("요건과 계산 방법 보기").closest("details") as HTMLDetailsElement).open).toBe(false);
  });

  it("최대 지원 가능액과 조합 목록은 접히지 않는다", async () => {
    await renderResult();
    expect(screen.getByText("최대 지원 가능액 (12개월 기준)").closest("details")).toBeNull();
    // 조합은 요약 영수증의 '받는 지원' 줄로 보인다(11/18) — 접지 않는다
    expect(screen.getAllByText(/^− .+원$/)[0].closest("details")).toBeNull();
  });

  it("대상아님·신청불가 정책은 Figma 결과 카드 variant로 만들지 않는다", async () => {
    await renderResult();
    expect(screen.queryByText(/^대상아님 \(\d+\)$/)).toBeNull();
    expect(screen.queryByText(/^신청불가 \(\d+\)$/)).toBeNull();
    for (const card of topCards()) {
      expect(within(card).queryByText("대상아님")).toBeNull();
      expect(within(card).queryByText("신청불가")).toBeNull();
    }
  });

  it("공식 결과 카드는 하나의 접근성 영역에 그대로 노출한다", async () => {
    await renderResult();
    const region = screen.getByRole("region", { name: /맞춤 혜택 \d+개/ });
    expect(within(region).getAllByRole("article").length).toBe(topCards().length);
  });
});
