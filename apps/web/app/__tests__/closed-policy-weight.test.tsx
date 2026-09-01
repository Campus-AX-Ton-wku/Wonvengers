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
 * 판정 규칙은 건드리지 않는다 — 1층 태그가 나이·지역·상태·소득만 보는 것은
 * 의도된 결정이다 (PRD F3-6). 고치는 것은 무게다: 상태 배지가 태그와 접수 기간을
 * 합쳐 말하고(lib/discovery.ts 의 cardStatus), 금액 색은 받을 수 있는 것에만 남는다.
 */

const 익산_대학생 = {
  birthDate: birthDateForAge(23),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

async function renderList() {
  saveAnswers(익산_대학생);
  render(<FindPoliciesPage />);
  await screen.findByRole("heading", { level: 1 });
}

/** 카드는 상세 화면으로 가는 링크다. 이름으로 집는다 — 위치는 그룹에 따라 바뀐다. */
function 카드(정책명: string): HTMLElement {
  const card = screen.getByText(정책명).closest("a");
  if (!card) throw new Error(`"${정책명}" 카드를 찾지 못했다`);
  return card;
}

/** 국토부 청년월세 — 2026-05-29 에 접수가 끝났다. */
const 마감된_카드 = () => 카드("청년월세 지원 (2026년 상시사업 전환)");
/** 익산 이사비 — 상시 접수라 지금 신청할 수 있다. */
const 열린_카드 = () => 카드("익산시 전입 청년 이사비·중개보수 지원사업");

describe("접수가 끝난 정책", () => {
  it("공고 상한 금액을 accent 색으로 띄우지 않는다", async () => {
    await renderList();

    expect(within(마감된_카드()).getByText("최대 480만원").className).not.toContain("accent");
  });

  /*
   * 배지 자체가 '접수 마감' 이라고 말한다. 예전에는 초록 '가능성 있음' 이 붙고
   * 마감 사실은 본문 문장에만 있었다 — 문구를 읽기 전에 이미 잘못 안심시켰다.
   */
  it("배지가 '접수 마감' 이고 초록이 아니다", async () => {
    await renderList();
    const 배지 = within(마감된_카드()).getByText("접수 마감");

    expect(배지.className).not.toContain("ok-");
  });

  it("언제 끝났는지를 카드에서 바로 알려준다", async () => {
    await renderList();

    expect(within(마감된_카드()).getByText("2026.05.29 접수 마감")).toBeTruthy();
  });

  /* 접수 중인 정책은 그대로다 — 마감 처리가 멀쩡한 카드까지 물들이면 안 된다. */
  it("접수 중인 정책의 금액은 accent 색을 유지한다", async () => {
    await renderList();

    expect(within(열린_카드()).getByText("최대 50만원").className).toContain("accent");
    expect(within(열린_카드()).getByText("신청 가능")).toBeTruthy();
  });
});
