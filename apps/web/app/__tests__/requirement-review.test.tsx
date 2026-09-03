// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import policiesJson from "@/data/policies.json";
import RequirementReview from "@/app/result/review/[id]/RequirementReview";
import { buildCalculationSummary } from "@/lib/summary";
import { loadDeclared, loadProfile, saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];
const policy = policies.find((item) => item.id === "jeonse-return-guarantee-fee-subsidy")!;

function setup() {
  window.localStorage.clear();
  saveListing(makeListing({ region: "서울특별시 광진구" }));
  saveProfile(makeProfile({ hasNoHouse: true, isContractHolder: true }));
}

describe("정책별 확인 필요 조건", () => {
  beforeEach(setup);

  it("이미 확인된 공통 조건은 빼고, 직접 답해야 하는 3개만 물어본다", async () => {
    render(<RequirementReview policy={policy} />);

    expect(await screen.findByRole("heading", { name: "3가지만 답하면 돼요" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "확인 필요 조건 3개" }).children).toHaveLength(3);

    expect(screen.getByText("전세보증금반환보증 가입 및 보증료 납부")).toBeTruthy();
    expect(screen.getByText("임차보증금 3억원 이하")).toBeTruthy();
    expect(screen.getByText(/연소득 기준/)).toBeTruthy();

    // 판정 질문으로 이미 통과한 조건은 여기서 다시 묻지 않는다.
    expect(screen.queryByText("무주택 임차인")).toBeNull();
    expect(screen.queryByText("임대차계약 명의자 본인")).toBeNull();
  });

  it("조건마다 성격에 맞는 입력을 준다 — 예/아니오와 금액", async () => {
    render(<RequirementReview policy={policy} />);
    await screen.findByRole("heading", { name: "3가지만 답하면 돼요" });

    expect(
      screen.getByRole("group", { name: "전세보증금반환보증(HUG·HF·SGI)에 가입하고 보증료를 냈나요?" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("임차보증금이 얼마인가요?")).toBeTruthy();
    expect(screen.getByLabelText("본인 연소득이 얼마인가요?")).toBeTruthy();
  });

  it("금액을 기준 안으로 넣으면 충족, 넘기면 미충족으로 바로 판정한다", async () => {
    const user = userEvent.setup();
    render(<RequirementReview policy={policy} />);
    await screen.findByRole("heading", { name: "3가지만 답하면 돼요" });

    // MoneyInput 은 만원 단위로 받는다 — 2억 8천만원.
    await user.type(screen.getByLabelText("임차보증금이 얼마인가요?"), "28000");
    expect(await screen.findByText("이 조건은 충족해요")).toBeTruthy();
    expect(loadDeclared().depositUnder300M).toBe(280_000_000);

    await user.clear(screen.getByLabelText("임차보증금이 얼마인가요?"));
    await user.type(screen.getByLabelText("임차보증금이 얼마인가요?"), "35000");
    expect(await screen.findByText("이 조건은 충족하지 않아요")).toBeTruthy();
  });

  it("세 조건을 모두 답하면 남은 개수가 0이 되고 결과 판정이 예상적용으로 바뀐다", async () => {
    const user = userEvent.setup();
    render(<RequirementReview policy={policy} />);
    await screen.findByRole("heading", { name: "3가지만 답하면 돼요" });

    await user.click(screen.getByRole("button", { name: "예" }));
    await user.type(screen.getByLabelText("임차보증금이 얼마인가요?"), "28000");
    await user.type(screen.getByLabelText("본인 연소득이 얼마인가요?"), "4000");

    expect(
      await screen.findByRole("heading", { name: "확인이 필요한 조건을 모두 답했어요" }),
    ).toBeTruthy();

    // 결과 화면이 쓰는 판정 경로도 같은 답을 읽어 '조건충족시가능'을 벗어난다.
    const summary = buildCalculationSummary(
      [policy],
      loadProfile()!,
      makeListing({ region: "서울특별시 광진구" }),
      "2026-09-03",
    );
    expect(summary.results[0].status).toBe("예상적용");
  });

  it("답을 지우면 다시 확인 필요로 돌아간다", async () => {
    const user = userEvent.setup();
    render(<RequirementReview policy={policy} />);
    await screen.findByRole("heading", { name: "3가지만 답하면 돼요" });

    await user.click(screen.getByRole("button", { name: "예" }));
    expect(await screen.findByText("이 조건은 충족해요")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "답 지우기" })[0]);
    expect(screen.queryByText("이 조건은 충족해요")).toBeNull();
    expect(loadDeclared().guaranteeEnrolled).toBeUndefined();
  });

  it("/eligibility 가 프로필을 다시 저장해도 여기서 답한 값은 살아남는다", async () => {
    const user = userEvent.setup();
    render(<RequirementReview policy={policy} />);
    await screen.findByRole("heading", { name: "3가지만 답하면 돼요" });
    await user.click(screen.getByRole("button", { name: "예" }));

    // 판정 질문 화면은 스텝마다 프로필을 통째로 덮어쓴다.
    saveProfile(makeProfile({ hasNoHouse: true, isContractHolder: true }));

    expect(loadDeclared().guaranteeEnrolled).toBe(true);
    expect(loadProfile()?.selfDeclared?.guaranteeEnrolled).toBe(true);
  });
});
