// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import { saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * 접수가 끝난 정책의 시각적 무게.
 *
 * 덱 캡처(docs/이미지/policies.png)에서 첫 카드가 '최대 480만원' + 초록
 * '가능성 있음' 인데 본문은 '2026-05-29에 접수가 끝났습니다' 였다. 가장 큰 금액과
 * 긍정 태그가 못 받는 정책에 붙어 심사위원이 먼저 보는 카드가 됐다.
 *
 * **태그 의미는 건드리지 않는다.** 1층 태그가 나이·지역·상태·소득만 보고 접수
 * 기간을 별도로 알려주는 것은 의도된 결정이다 (PolicyCard.tsx:43, PRD F3-6).
 * 고치는 것은 무게다 — 태그·금액·기간이 한 눈에 함께 읽혀야 한다.
 */

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

/** 접수가 끝났다고 적힌 카드. 없으면 이 테스트의 전제가 깨진 것이다. */
function 마감된_카드(): HTMLElement {
  const 안내 = screen.getAllByText(/접수가 끝났습니다/)[0];
  const card = 안내?.closest("article");
  if (!card) throw new Error("접수 마감 안내가 있는 카드를 찾지 못했다");
  return card as HTMLElement;
}

/**
 * 금액 줄. '공고 상한' 라벨 바로 다음 줄이다 — 라벨이 위, 값이 아래다.
 * (예전에는 금액이 위, 라벨이 아래였다. 토스식 위계로 뒤집었다.)
 */
function 금액줄(card: HTMLElement): HTMLElement {
  const 라벨 = within(card).getByText("공고 상한");
  return 라벨.nextElementSibling as HTMLElement;
}

/** 정책명·태그가 함께 있는 카드 머리. */
function 카드머리(card: HTMLElement): HTMLElement {
  const tag = within(card).getByText(/가능성 있음|확인 필요|해당 없음/);
  return tag.parentElement as HTMLElement;
}

describe("접수가 끝난 정책", () => {
  it("공고 상한 금액을 accent 색으로 띄우지 않는다", async () => {
    await renderList();

    expect(금액줄(마감된_카드()).className).not.toContain("accent");
  });

  /*
   * 태그 자체도 색을 잃는다. 초록은 "지금 받을 수 있다"는 신호라, 마감된 카드에
   * 붙으면 문구를 읽기 전에 이미 잘못 안심시킨다 (PolicyCard 의 CLOSED_TAG_STYLE).
   */
  it("'가능성 있음' 태그가 마감 카드에서는 초록이 아니다", async () => {
    await renderList();
    const 태그 = within(마감된_카드()).getByText("가능성 있음");

    expect(태그.className).not.toContain("ok-");
  });

  it("접수 마감을 카드 머리에서 알려준다 — 본문까지 읽기 전에 보여야 한다", async () => {
    await renderList();
    const card = 마감된_카드();

    // 정책명 바로 아래 기관 줄에 붙는다. 태그·금액만 훑는 사람도 지나칠 수 없다.
    expect(카드머리(card).nextElementSibling?.textContent).toMatch(/접수 마감/);
  });

  /* 접수 중인 정책은 그대로다 — 마감 처리가 멀쩡한 카드까지 물들이면 안 된다. */
  it("접수 중인 정책의 금액은 accent 색을 유지한다", async () => {
    await renderList();
    const 열린카드 = screen
      .getAllByRole("article")
      .filter((c) => within(c).queryByText(/접수가 끝났습니다/) === null)
      .find((c) => within(c).queryByText("공고 상한") !== null);
    if (!열린카드) throw new Error("접수 중이고 금액이 있는 카드를 찾지 못했다");

    expect(금액줄(열린카드).className).toContain("accent");
  });
});
