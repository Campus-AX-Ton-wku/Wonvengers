// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FindPoliciesPage from "@/app/find/policies/page";
import { EMPTY_ANSWERS, saveAnswers } from "@/lib/storage";
import policiesJson from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

/** QA체크리스트 "1층 — 목록" 절을 자동화한 것. */

const 익산_대학생 = {
  birthDate: birthDateForAge(23),
  region: "전북특별자치도 익산시" as const,
  status: "대학생" as const,
  incomeBracket: 1,
};

describe("/find/policies", () => {
  it("답변을 모두 모름으로 둬도 목록이 뜬다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);

    // localStorage 를 읽기 전에는 자리만 잡는다
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    // 5건 중 2건은 접수가 끝났다. 제목은 지금 신청할 수 있는 것만 센다.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "지금 신청할 수 있는 지원금 3건"
    );
  });

  it("답변 요약 칩으로 어떤 답의 결과인지 보여준다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // '익산시' 는 정책 카드의 기관명에도 나오므로 칩 목록 안에서만 찾는다
    const chips = within(screen.getByRole("list", { name: "답변 요약" }));
    for (const chip of ["23세", "익산시", "대학생", "월 100만원 이하"]) {
      expect(chips.getByText(chip), chip).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "답변 고치기" }).getAttribute("href")).toBe("/find");
  });

  it("답하지 않은 항목은 칩에 '모름'으로 남는다", async () => {
    saveAnswers({ ...익산_대학생, status: null, incomeBracket: null });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const chips = within(screen.getByRole("list", { name: "답변 요약" }));
    expect(chips.getByText("상태 모름")).toBeTruthy();
    expect(chips.getByText("소득 모름")).toBeTruthy();
  });

  it("제목의 건수와 카드 수가 같다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 익산 23세 대학생·소득 1구간 → 후보 3건(그중 국토부 청년월세 1건은 마감), 해당 없음 2건
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "지금 신청할 수 있는 지원금 2건"
    );
    expect(screen.getByText("이번 회차는 마감된 지원금 1건")).toBeTruthy();
    expect(screen.getByText("해당되지 않는 지원금 2건 보기")).toBeTruthy();
  });

  it("해당 없음 카드에 탈락 이유가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 전북 정착은 재직자만 대상이다
    expect(screen.getByText(/재직만 신청할 수 있습니다/)).toBeTruthy();
  });

  it("접수가 끝난 정책에 접수 종료 안내가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    expect(screen.getByText(/2026-05-29에 접수가 끝났습니다/)).toBeTruthy();
  });

  it("후보가 있으면 2층 진입 CTA 가 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    const cta = screen.getByRole("link", { name: /얼마를 내게 될까/ });
    expect(cta.getAttribute("href")).toBe("/calculate");
  });

  it("후보가 없으면 이유를 안내하고 2층 CTA 를 숨긴다", async () => {
    saveAnswers({ ...익산_대학생, birthDate: birthDateForAge(55) });
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("해당되는 지원금이 없어요");
    expect(screen.queryByRole("link", { name: /얼마를 내게 될까/ })).toBeNull();
  });

  it("고지 문구는 접히지 않고 항상 보인다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/신청 자격을 확정하는 것이 아닙니다/)).toBeTruthy();
  });
});

/**
 * 접수가 끝난 정책을 '지금 받을 수 있는 것'과 섞지 않는다.
 *
 * 1층 태그는 나이·지역·상태·소득만 보므로 마감된 정책도 초록 '가능성 있음' 이 된다
 * (PRD F3-6, 의도된 결정). 문제는 그 카드가 제목의 건수에 함께 세어진다는 것이고,
 * 하필 정책 데이터의 첫 항목인 국토부 청년월세가 금액도 가장 커서 — 가장 크고 가장
 * 위에 있는 초록 카드가 못 받는 것이 됐다.
 *
 * 목록에서 지우지는 않는다. 다음 회차에 다시 열리는 사업이라, 없애면 "그런 지원금이
 * 아예 없다"로 읽혀 또 다른 거짓이 된다.
 */
describe("/find/policies 접수 마감 분리", () => {
  const 신청가능영역 = () => screen.getByRole("region", { name: /지금 신청할 수 있는 지원금/ });
  const 마감영역 = () => screen.getByRole("region", { name: /이번 회차는 마감된 지원금/ });

  it("마감된 카드는 신청 가능 영역이 아니라 마감 영역에 있다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    // 국토부 청년월세는 2026-05-29 에 접수가 끝났다
    expect(within(신청가능영역()).queryByText(/2026-05-29에 접수가 끝났습니다/)).toBeNull();
    expect(within(마감영역()).getByText(/2026-05-29에 접수가 끝났습니다/)).toBeTruthy();
  });

  it("가장 큰 금액이 마감 건이어도 첫 카드를 차지하지 않는다", async () => {
    saveAnswers(익산_대학생);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(document.querySelector("article")?.textContent).not.toMatch(/접수가 끝났습니다/);
  });

  // 만 18세는 마감된 두 사업(국토부 청년월세 19~34세, 전북 정착 재직자)의 후보가
  // 아니라, 남는 후보가 상시 접수뿐이다.
  it("마감 건이 없으면 마감 영역 자체를 내보내지 않는다", async () => {
    saveAnswers({ ...익산_대학생, birthDate: birthDateForAge(18) });
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByText(/이번 회차는 마감된 지원금/)).toBeNull();
  });

  /*
   * 후보가 있긴 한데 전부 마감인 경우. 그냥 '해당되는 지원금이 없어요' 라고 하면
   * "너는 대상이 아니다"로 읽히는데, 실제로는 다음 회차를 기다리면 되는 상황이다.
   */
  it("후보가 전부 마감이면 제목이 그렇게 말하고, 카드는 그대로 보여준다", async () => {
    saveAnswers({
      birthDate: birthDateForAge(30),
      region: "전북특별자치도", // REGION_OPTIONS 의 value (라벨은 "전북특별자치도 (익산시 외)")
      status: "재직",
      incomeBracket: 2,
    });
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "지금 신청할 수 있는 지원금이 없어요"
    );
    expect(screen.getByText("이번 회차는 마감된 지원금 2건")).toBeTruthy();
  });
});

/**
 * 출처는 지역 공고 하나로 간다.
 *
 * 예전에는 카드에 `온통청년 미등록` 배지가 붙었는데, 그건 "정부 DB 에 없다"가 아니라
 * "정책번호를 매핑하지 않았다"는 뜻이었다 — 찾아본 적이 없는데 찾지 못했다고 말했다.
 * 확인한 사실만 말하기 위해, 팀이 직접 대조한 공고 원문만 보여준다.
 */
describe("/find/policies 정책 출처", () => {
  const policies = policiesJson as PolicyMeta[];

  it("정책마다 공고 원문 링크가 있고, 실제 sourceUrl 을 가리킨다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const links = screen.getAllByRole("link", { name: "공고 원문 →" });
    expect(links).toHaveLength(policies.length);

    const shown = new Set(links.map((a) => a.getAttribute("href")));
    for (const p of policies) {
      expect(shown.has(p.sourceUrl), `${p.id}: 공고 원문 링크 없음`).toBe(true);
    }
  });

  it("검수한 정책은 대조 날짜를, 검수 전 정책은 대조하지 않았다고 밝힌다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    const verified = policies.filter((p) => p.verifiedAt !== null);
    const unverified = policies.filter((p) => p.verifiedAt === null);

    for (const p of verified) {
      expect(
        screen.getAllByText(`팀이 ${p.verifiedAt}에 공고 원문과 대조했습니다.`).length
      ).toBeGreaterThan(0);
    }
    // 미검수 정책이 몇 개든 — 지금은 0개다 — 화면 경고 수와 정확히 맞아야 한다.
    //
    // 예전에는 여기서 `unverified.length > 0` 을 단언했다. 익산형 청년월세가
    // verifiedAt: null 이라는 데이터 사실에 기대고 있었는데, 2026-08-30 에 그
    // 정책을 검수하면서 전제가 깨졌다. 데이터가 바뀌었을 뿐인데 테스트가 깨지는 건
    // 검증 대상을 잘못 잡은 것이다.
    //
    // 미검수 분기가 화면에 어떻게 그려지는지는 policy-verification-notice.test.tsx 가
    // 픽스처로 확인한다 — policies.json 이 어떻게 바뀌든 그 검증은 계속 돈다.
    expect(screen.queryAllByText(/아직 공고 원문과 대조하지 않았습니다/)).toHaveLength(
      unverified.length
    );
  });

  it("온통청년 대조 표시가 화면에 없다", async () => {
    saveAnswers(EMPTY_ANSWERS);
    const { container } = render(<FindPoliciesPage />);
    await screen.findByRole("heading", { level: 1 });

    expect(container.textContent).not.toMatch(/온통청년/);
  });
});
