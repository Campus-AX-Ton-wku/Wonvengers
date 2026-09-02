// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import { EMPTY_ANSWERS, saveAnswers } from "@/lib/storage";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

/** QA체크리스트 "1층 — 목록" 절을 자동화한 것. */

const 익산_대학생 = {
  birthDate: birthDateForAge(23),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};

/** 정책 카드는 상세 화면으로 가는 링크다. 목록 어디에 있든 href 로 찾는다. */
function 카드들(): HTMLElement[] {
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("href")?.startsWith("/find/policies/"));
}

/** 지금 신청할 수 없는 것들이 들어가는 접힌 묶음. */
function 신청불가묶음(): HTMLDetailsElement {
  const summary = screen.getByText(/신청할 수 없는 지원금 \d+개/);
  return summary.closest("details") as HTMLDetailsElement;
}

describe("/find/policies", () => {
  it("답변을 모두 모름으로 둬도 목록이 뜬다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);

    // localStorage 를 읽기 전에는 자리만 잡는다
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    // 6건 중 2건은 접수가 끝났다. 제목은 지금 신청할 수 있는 것만 센다.
    // 금액 헤드라인은 앞 화면(/find/result)이 맡는다 — 여기서 또 보여주지 않는다.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "받을 수 있는 주거 혜택 4개"
    );
  });

  it("어떤 답의 결과인지 한 줄로 보여주고 고치러 갈 길을 준다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 소득 구간은 이 줄에 두지 않는다 — '조건 수정' 화면에 그대로 있다.
    expect(screen.getByText("23세 · 익산시 · 대학생")).toBeTruthy();
    expect(screen.getByRole("link", { name: /조건 수정/ }).getAttribute("href")).toBe("/find");
  });

  it("답하지 않은 항목은 요약 줄에 '모름'으로 남는다", async () => {
    saveAnswers({ ...익산_대학생, status: null });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("23세 · 익산시 · 상태 모름")).toBeTruthy();
  });

  it("제목의 건수와 펼쳐진 카드 수가 같다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 익산 23세 월세 거주 대학생·소득 1구간 → 후보 3건(그중 국토부 청년월세 1건은
    // 마감), 해당 없음 3건(전세 전용인 보증료 지원 포함)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "받을 수 있는 주거 혜택 2개"
    );

    const 신청가능영역 = screen.getByRole("region", { name: "받을 수 있는 주거 혜택 2개" });
    expect(within(신청가능영역).getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("신청할 수 없는 지원금 4개")).toBeTruthy();
  });

  it("카드를 누르면 그 정책의 상세 화면으로 간다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const 이사비 = screen.getByText("익산시 전입 청년 이사비·중개보수 지원사업").closest("a");
    expect(이사비?.getAttribute("href")).toBe("/find/policies/iksan-newcomer-moving-cost-support");
  });

  it("후보가 있으면 2층 진입 CTA 가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const cta = screen.getByRole("link", { name: /내 월세는 얼마일까/ });
    expect(cta.getAttribute("href")).toBe("/calculate");
  });

  /*
   * 연세는 이 앱이 다른 앱과 다르게 다루는 계약이다. 2층이 연세 선납액을 월
   * 환산해 지원금을 계산하므로(lib/rent.ts), 1층도 월세 지원 사업의 대상으로
   * 봐야 한다 — 여기서 탈락시키면 1층이 '대상 아님'이라고 한 사람을 2층이
   * 계산해 주는 모순이 된다.
   */
  it("연세 거주자도 월세 지원 사업의 대상으로 본다", async () => {
    saveAnswers({ ...익산_대학생, housingType: "연세" as const });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const 신청가능영역 = screen.getByRole("region", { name: /받을 수 있는 주거 혜택/ });
    expect(within(신청가능영역).getByText("청년 주거급여 분리지급")).toBeTruthy();
    expect(screen.getByRole("link", { name: /내 연세 부담은 얼마나 줄까/ })).toBeTruthy();
  });

  /*
   * 2층(계약 조건 → 최종 주거비)은 계약 형태로 월세·연세만 받는다. 전세 거주자를
   * 그리로 보내면 자기 계약을 입력할 방법이 없는 화면에 도착한다. 문구만 전세용으로
   * 바꾸는 건 눌러서 막히는 길을 만드는 것이라, 대신 왜 아직 못 하는지를 말한다.
   */
  it("전세 거주자에게는 월세 계산 CTA 대신 안내를 준다", async () => {
    saveAnswers({ ...익산_대학생, housingType: "전세" as const });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /내 월세는 얼마일까/ })).toBeNull();
    expect(screen.getByText(/전세 부담이 얼마나 줄어드는지는 아직/)).toBeTruthy();
  });

  it("전세 거주자에게는 전세 전용 지원금이 신청 가능으로 뜬다", async () => {
    saveAnswers({ ...익산_대학생, housingType: "전세" as const });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const 신청가능영역 = screen.getByRole("region", { name: /받을 수 있는 주거 혜택/ });
    expect(within(신청가능영역).getByText("전세보증금반환보증 보증료 지원")).toBeTruthy();
  });

  it("후보가 없으면 이유를 안내하고 2층 CTA 를 숨긴다", async () => {
    saveAnswers({ ...익산_대학생, birthDate: birthDateForAge(55), housingType: "그 외" as const });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "아쉽게도 해당되는 주거 혜택이 없어요"
    );
    expect(screen.queryByRole("link", { name: /내 월세는 얼마일까/ })).toBeNull();
  });

  it("고지 문구는 접히지 않고 항상 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/신청 자격을 확정하는 것이 아닙니다/)).toBeTruthy();
  });

  /*
   * 공고 문구·요건·신청 기간·출처는 상세 화면으로 내려갔다. 목록에 남아 있으면
   * 카드 다섯 장이 토글 다섯 개로 끊긴다 (find/PolicyCard.tsx 주석).
   */
  it("카드에는 상태·이름·기관·금액만 남는다", async () => {
    saveAnswers(익산_대학생);
    const { container } = render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByText(/자세히 보기/)).toBeNull();
    expect(screen.queryByRole("link", { name: "공고 원문 →" })).toBeNull();
    expect(container.textContent).not.toMatch(/공고 원문과 대조/);
  });
});

/**
 * 지금 신청할 수 없는 것은 접어 둔다.
 *
 * 1층 태그는 나이·지역·상태·소득만 보므로 마감된 정책도 후보에 남는다
 * (PRD F3-6, 의도된 결정). 문제는 그 카드가 목록에서 자리를 차지한다는 것이고,
 * 하필 정책 데이터의 첫 항목인 국토부 청년월세(최대 480만원)가 마감이라 —
 * 가장 큰 금액이 실제로 받을 수 있는 50만원짜리보다 크게 읽혔다.
 *
 * 지우지는 않는다. 마감 건은 다음 회차에 다시 열리고, 대상이 아닌 건은 왜
 * 아닌지가 답을 고칠 단서다. 없애면 "그런 지원금이 아예 없다"로 읽힌다.
 */
describe("/find/policies 신청할 수 없는 지원금", () => {
  it("마감된 카드와 대상이 아닌 카드는 접힌 묶음 안에 있다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const 묶음 = 신청불가묶음();
    expect(묶음.open).toBe(false);
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    expect(within(묶음).getByText("2026.05.29 접수 마감")).toBeTruthy();
    // 전북 정착은 재직자만 대상이다
    expect(within(묶음).getByText(/재직만 신청할 수 있습니다/)).toBeTruthy();
  });

  it("가장 큰 금액이 마감 건이어도 첫 카드를 차지하지 않는다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(카드들()[0].textContent).not.toMatch(/접수 마감/);
  });

  // 만 18세는 마감된 두 사업(국토부 청년월세 19~34세, 전북 정착 재직자)의 후보가
  // 아니고 해당 없음이 되므로, 묶음 자체는 남는다. 신청 가능 쪽에 마감이 섞이지
  // 않는 것이 요점이다.
  it("신청 가능 영역에는 마감된 카드가 없다", async () => {
    saveAnswers({ ...익산_대학생, birthDate: birthDateForAge(18) });
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const 신청가능영역 = screen.getByRole("region", { name: /받을 수 있는 주거 혜택/ });
    expect(within(신청가능영역).queryByText(/접수 마감/)).toBeNull();
  });

  /*
   * 후보가 있긴 한데 전부 마감인 경우. 그냥 '해당되는 것이 없어요' 라고 하면
   * "너는 대상이 아니다"로 읽히는데, 실제로는 다음 회차를 기다리면 되는 상황이다.
   */
  it("후보가 전부 마감이면 제목이 그렇게 말하고, 묶음은 펼쳐 둔다", async () => {
    saveAnswers({
      birthDate: birthDateForAge(30),
      region: "전북특별자치도", // REGION_OPTIONS 의 value (라벨은 "전북특별자치도 (익산시 외)")
      status: "재직",
      incomeBracket: 2,
      housingType: "월세" as const,
    });
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "지금 받을 수 있는 주거 혜택이 없어요"
    );
    // 보여줄 것이 접힌 묶음뿐이면 접어 둘 이유가 없다 — 빈 화면으로 읽힌다.
    expect(신청불가묶음().open).toBe(true);
  });
});
