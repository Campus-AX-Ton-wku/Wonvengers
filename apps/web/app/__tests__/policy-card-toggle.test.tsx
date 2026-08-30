// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import ResultPage from "@/app/result/page";
import { saveAnswers, saveListing, saveProfile } from "@/lib/storage";
import { birthDateForAge, makeListing, makeProfile } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});

/**
 * 정책 카드 세부사항 접기.
 *
 * jsdom 은 레이아웃을 하지 않아 "보이는지"를 직접 물을 수 없다. 대신 요구사항을
 * 구조로 확인한다 — 세부 내용은 닫힌 <details> 안에 있어야 하고, 항상 보여야 하는
 * 것(신청 링크·금액·태그)은 카드 안의 <details> 밖에 있어야 한다.
 *
 * 주의: '해당되지 않는 지원금 N건 보기' 그룹 자체가 <details> 라서, 그 안의 카드는
 * 무엇이든 details 안에 있다. 카드 단위로 좁혀서 본다.
 *
 * 카드를 위치로 집지 않는다. 예전에는 topCards()[0] 이 곧 국토부 청년월세였는데,
 * 그건 그 정책이 데이터의 첫 항목이자 접수가 끝난 사업이라는 우연이었다 — 지금은
 * 마감 건을 아래 영역으로 내리므로 첫 카드가 아니다. 이름으로 찾는다.
 */

/** 목록 맨 위(해당 없음 그룹 밖)의 정책 카드들 */
function topCards(): HTMLElement[] {
  return screen.getAllByRole("article").filter((card) => card.closest("details") === null);
}

/** 이름으로 카드를 집는다. 목록 어느 영역에 있든 상관없다. */
function 카드(정책명: string | RegExp): HTMLElement {
  const card = screen.getByText(정책명).closest("article");
  expect(card, `"${정책명}" 카드를 찾지 못했다`).not.toBeNull();
  return card as HTMLElement;
}

/** 국토부 청년월세 — 2026-05-29 에 접수가 끝나 '마감된 지원금' 영역에 있다. */
const 청년월세카드 = () => 카드("청년월세 지원 (2026년 상시사업 전환)");

function 카드안_토글(card: HTMLElement, text: string | RegExp): HTMLDetailsElement {
  const node = within(card).getByText(text);
  const details = node.closest("details") as HTMLDetailsElement | null;
  expect(details, `"${text}" 가 카드 안 토글에 들어 있지 않다`).not.toBeNull();
  return details!;
}

describe("1층 정책 카드", () => {
  const 익산_대학생 = {
    birthDate: birthDateForAge(23),
    region: "전북특별자치도 익산시" as const,
    status: "대학생" as const,
    incomeBracket: 1,
  };

  async function renderList() {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });
  }

  it("'추가로 확인할 것'은 닫힌 토글 안에 있다", async () => {
    await renderList();
    const details = 카드안_토글(청년월세카드(), "추가로 확인할 것");
    expect(details.open).toBe(false);
  });

  it("토글 라벨에 항목 수가 적혀 있어 열지 않고도 분량을 안다", async () => {
    await renderList();
    expect(within(청년월세카드()).getByText(/자세히 보기 · 확인할 항목 \d+개/)).toBeTruthy();
  });

  it("신청 기간과 공고 출처도 토글 안으로 들어간다", async () => {
    await renderList();
    expect(카드안_토글(청년월세카드(), /신청 기간 2026-03-30/).open).toBe(false);
    // 출처는 접어 두지만 카드마다 반드시 있다 — 이 숫자가 어디서 왔는지 물을 수 있어야 한다.
    expect(카드안_토글(청년월세카드(), /2026-08-23에 공고 원문과 대조했습니다/).open).toBe(false);
  });

  it("정책명·태그·상한 금액·접수 종료 안내는 토글 밖에 남는다", async () => {
    await renderList();
    const card = 청년월세카드();

    expect(within(card).getByText("청년월세 지원 (2026년 상시사업 전환)").closest("details")).toBeNull();
    expect(within(card).getByText(/2026-05-29에 접수가 끝났습니다/).closest("details")).toBeNull();
    // 목록의 목적이 "무엇을 최대 얼마까지 받나"를 훑는 것이므로 금액은 접지 않는다
    expect(within(card).getByText("최대 480만원").closest("details")).toBeNull();
    expect(within(card).getByText("공고 상한").closest("details")).toBeNull();
  });

  // 카드를 한 화면에 여러 장 훑을 수 있게, 긴 공고 문구와 신청 정보는 토글로 내렸다.
  it("공고 문구와 공식 페이지 링크는 토글 안으로 내려갔다", async () => {
    await renderList();
    const card = 청년월세카드();

    expect(within(card).getByText(/생애 1회 최대 24개월/).closest("details")).not.toBeNull();
    expect(within(card).getByRole("link", { name: "공식 페이지 →" }).closest("details")).not.toBeNull();
  });
});

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
    const details = 카드안_토글(topCards()[0], "충족");
    expect(details.open).toBe(false);
  });

  it("요건 토글 라벨에 충족 건수가 적혀 있다", async () => {
    await renderResult();
    expect(within(topCards()[0]).getByText(/요건 자세히 보기 · 충족 \d+/)).toBeTruthy();
  });

  it("검수 메모(notes)와 확인 날짜는 '검수 상태' 토글 안에 있다", async () => {
    await renderResult();
    const card = topCards().find((c) => within(c).queryByText(/복지로 공지/) !== null);
    expect(card, "국토부 카드를 찾지 못했다").toBeTruthy();

    const details = 카드안_토글(card!, /복지로 공지/);
    expect(details.open).toBe(false);
    expect(within(details).getByText(/2026년 기준/)).toBeTruthy();
    expect(within(card!).getByText("검수 상태 · 참고사항")).toBeTruthy();
  });

  it("상태 태그·예상액·산식·신청 링크는 토글 밖에 남는다", async () => {
    await renderResult();
    const card = topCards()[0];

    expect(within(card).getByText(/^(예상적용|조건충족시가능)$/).closest("details")).toBeNull();
    expect(within(card).getByText(/이 정책 단독 예상액/).closest("details")).toBeNull();
    expect(within(card).getByRole("link", { name: "신청 페이지로 이동" }).closest("details")).toBeNull();
  });

  it("최대 지원 가능액과 조합 목록은 접히지 않는다", async () => {
    await renderResult();
    expect(screen.getByText("최대 지원 가능액 (12개월 기준)").closest("details")).toBeNull();
    expect(screen.getByText("이 금액은 아래 조합으로 계산했습니다").closest("details")).toBeNull();
  });

  /* 받을 수 없는 정책이 목록의 절반을 차지하면 받을 수 있는 것이 아래로 밀린다.
     이 픽스처는 대상아님 1건 · 신청불가 2건 · 예상적용 2건이 나온다. */
  it("'대상아님' 그룹은 접혀 있고 라벨에 건수가 있다", async () => {
    await renderResult();

    const label = screen.getByText(/^대상아님 \(\d+\)$/);
    const details = label.closest("details") as HTMLDetailsElement | null;
    expect(details, "대상아님 그룹이 토글이 아니다").not.toBeNull();
    expect(details!.open).toBe(false);
    // 접었어도 안에 카드가 있어야 한다 — 왜 대상이 아닌지는 열면 그대로 나온다
    expect(within(details!).getAllByRole("article").length).toBeGreaterThan(0);
  });

  it("받을 수 있는 정책과 신청불가는 접지 않는다", async () => {
    await renderResult();

    for (const status of ["예상적용", "신청불가"]) {
      const heading = screen.getByText(new RegExp(`^${status} \\(\\d+\\)$`));
      expect(heading.closest("details"), `${status} 그룹이 접혀 있다`).toBeNull();
    }
  });
});
