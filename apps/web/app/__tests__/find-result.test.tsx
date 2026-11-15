// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FindResultPage from "@/app/find/result/page";
import policiesJson from "@/data/policies.json";
import { saveAnswers } from "@/lib/storage";
import { benefitCeiling } from "@/lib/benefit";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import type { PolicyMeta } from "@/lib/types";

/**
 * 1층 결과 요약.
 *
 * 질문 네 개에 답한 보상을 주는 화면이다. 예전에는 이 숫자가 목록 맨 위 세 줄로
 * 스쳐 지나갔다. 목록은 이 화면의 CTA 가 연다.
 */

const 익산_대학생 = {
  birthDate: birthDateForAge(24),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

async function render요약(answers: Parameters<typeof saveAnswers>[0]) {
  saveAnswers(answers);
  render(<FindResultPage />);
  await screen.findByRole("heading", { level: 1 });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("/find/result", () => {
  /*
   * 익산 이사비·중개보수(최대 50만원)는 2026-05-14 예산 소진으로 마감됐다(2026-11-03 원문
   * 재대조). 금액 헤드라인을 보려면 그 사업이 접수 중이던 날로 고정한다 — 2026-02-02 에는
   * 이사비와 주거급여 분리지급 2건이 열려 있고 국토부 청년월세(3/30 시작)는 아직이다.
   * Date 만 고정해야 findBy* 의 대기 타이머가 그대로 돈다.
   */
  describe("이사비가 접수 중이던 날(2026-02-02)", () => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-02-02T12:00:00+09:00"));
    });
    afterAll(() => vi.useRealTimers());

    it("가장 큰 금액과 건수를 말한다", async () => {
      await render요약(익산_대학생);

      // 2026-11-15 에 넣은 익산 전입 지원 2건(상시)도 열려 있다 — 가장 큰 상한은 주소전입 학생 지원 최대 100만원.
      expect(screen.getByText("지금 신청할 수 있는")).toBeTruthy();
      expect(screen.getByText("최대 100만원")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("지원금 4건이 있어요");
    });

    /*
     * 합산하지 않는다. 중복 수급 제한(exclusiveGroup) 때문에 상한을 더하면 실제로는
     * 받을 수 없는 금액이 되고, 정확한 조합은 계약 조건이 있어야 계산할 수 있다.
     * 큰 숫자를 크게 띄우는 화면이라 이 약속이 깨지면 피해가 가장 크다.
     */
    it("금액을 합산하지 않는다 — 어떤 한 정책의 상한과 같다", async () => {
      await render요약(익산_대학생);

      const 개별상한 = (policiesJson as PolicyMeta[])
        .map((p) => benefitCeiling(p)?.label)
        .filter((l): l is string => l !== undefined);
      const 보이는금액 = screen.getByText(/^최대 |^월 최대 /).textContent;

      expect(개별상한).toContain(보이는금액);
    });

    it("CTA 가 목록으로 보낸다", async () => {
      await render요약(익산_대학생);

      expect(
        screen.getByRole("link", { name: /지원금 4건 자세히 보기/ }).getAttribute("href")
      ).toBe("/find/policies");
    });
  });

  /*
   * 후보는 있는데 전부 마감. '해당되는 지원금이 없어요' 로 말하면 대상이 아니라는
   * 뜻으로 읽히지만, 실제로는 다음 회차를 기다리면 되는 상황이다.
   */
  it("후보가 전부 마감이면 대상이 아닌 것과 구분해 말한다", async () => {
    await render요약({
      birthDate: birthDateForAge(30),
      region: "전북특별자치도 전주시",
      status: "재직",
      incomeBracket: 2,
      housingType: "월세" as const,
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "지금 신청할 수 있는 지원금이 없어요"
    );
    expect(screen.getByText(/다음 모집 공고를 기다려야 합니다/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /어떤 지원금이었는지 보기/ })).toBeTruthy();
  });

  it("후보가 아예 없으면 그렇게 말한다", async () => {
    // 익산 전입장려금은 나이 · 상태 조건이 없어 익산 사용자는 늘 후보가 있다 — 목표 지역 밖(전주)으로 만든다.
    await render요약({
      ...익산_대학생,
      region: "전북특별자치도 전주시",
      birthDate: birthDateForAge(55),
      housingType: "그 외" as const,
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("아쉽게도 해당되는 지원금이 없어요");
    expect(screen.getByRole("link", { name: /왜 해당되지 않는지 보기/ })).toBeTruthy();
  });

  /*
   * 이 화면은 숫자 하나만 말한다. 답변 칩·마감 안내·주석을 함께 두면 정작 큰
   * 숫자가 여러 덩어리 중 하나가 된다. 그 정보들은 목록 화면이 그대로 갖고 있다.
   */
  it("금액과 건수 말고는 아무것도 두지 않는다", async () => {
    await render요약(익산_대학생);

    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("list", { name: "답변 요약" })).toBeNull();
    expect(screen.queryByText(/이번 회차는 마감된/)).toBeNull();
  });
});
