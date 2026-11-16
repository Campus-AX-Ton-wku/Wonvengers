// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PolicyCard from "@/app/find/PolicyCard";
import policiesJson from "@/data/policies.json";
import { resolveAnswers } from "@/lib/age";
import { tagPolicy } from "@/lib/filter";
import type { PolicyMeta } from "@/lib/types";
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
 *
 * 11/17 부터 목록(/find/policies)은 마감된 정책을 보여 주지 않는다. 카드가 마감 상태를 그리는 규칙은
 * 그대로 남겨 두므로(찜한 정책처럼 다른 곳에서 다시 쓸 수 있다) 카드를 직접 그려 확인한다.
 */

const policies = policiesJson as PolicyMeta[];
const AS_OF = "2026-11-17";

const 익산_대학생 = {
  birthDate: birthDateForAge(23),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

/** 그 정책 카드 하나를 익산 대학생 답으로 그린다. */
function render카드(id: string) {
  const policy = policies.find((p) => p.id === id)!;
  render(<PolicyCard policy={policy} result={tagPolicy(policy, resolveAnswers(익산_대학생, AS_OF))} asOfISO={AS_OF} />);
}

/** 카드는 상세 화면으로 가는 링크다. 이름으로 집는다 — 위치는 그룹에 따라 바뀐다. */
function 카드(정책명: string): HTMLElement {
  const card = screen.getByText(정책명).closest("a");
  if (!card) throw new Error(`"${정책명}" 카드를 찾지 못했다`);
  return card;
}

/** 국토부 청년월세 — 2026-05-29 에 접수가 끝났다. */
const 마감된_카드 = () => 카드("청년월세 지원 (2026년 상시사업 전환)");
/**
 * 청년 주거급여 분리지급 — 상시 신청이라 지금 신청할 수 있다.
 * (예전엔 익산 이사비였는데, 2026-11-03 원문 재대조에서 2026-05-14 예산 소진 마감이 확인됐다.)
 */
const 열린_카드 = () => 카드("청년 주거급여 분리지급");

describe("접수가 끝난 정책", () => {
  it("공고 상한 금액을 accent 색으로 띄우지 않는다", () => {
    render카드("moland-youth-rent-support");

    expect(within(마감된_카드()).getByText("최대 480만원").className).not.toContain("accent");
  });

  /*
   * 배지 자체가 '접수 마감' 이라고 말한다. 예전에는 초록 '가능성 있음' 이 붙고
   * 마감 사실은 본문 문장에만 있었다 — 문구를 읽기 전에 이미 잘못 안심시켰다.
   */
  it("배지가 '접수 마감' 이고 초록이 아니다", () => {
    render카드("moland-youth-rent-support");
    const 배지 = within(마감된_카드()).getByText("접수 마감");

    expect(배지.className).not.toContain("ok-");
  });

  it("언제 끝났는지를 카드에서 바로 알려준다", () => {
    render카드("moland-youth-rent-support");

    expect(within(마감된_카드()).getByText("2026.05.29 접수 마감")).toBeTruthy();
  });

  /* 접수 중인 정책은 그대로다 — 마감 처리가 멀쩡한 카드까지 물들이면 안 된다. */
  it("접수 중인 정책의 금액은 accent 색을 유지한다", () => {
    render카드("youth-housing-benefit-split-payment");

    expect(within(열린_카드()).getByText("월 최대 21만 2,000원").className).toContain("accent");
    // 분리지급은 원가구 소득을 1층에서 못 가려 배지가 '확인 필요' 다 — 요점은 '접수 마감' 이 아니라는 것.
    expect(within(열린_카드()).queryByText("접수 마감")).toBeNull();
  });
});
