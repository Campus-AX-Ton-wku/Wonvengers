// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationPreparation from "@/app/find/policies/[id]/prepare/ApplicationPreparation";
import policiesJson from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";

const policy = (policiesJson as PolicyMeta[]).find(
  (item) => item.id === "iksan-newcomer-moving-cost-support"
)!;

describe("신청 준비 흐름", () => {
  beforeEach(() => window.localStorage.clear());

  it("'자격 조건 확인' 줄은 그 정책에서 아직 확인할 조건을 구체적으로 보여 준다 (11/17)", async () => {
    const moveIn = (policiesJson as PolicyMeta[]).find((item) => item.id === "iksan-move-in-household-incentive")!;
    render(<ApplicationPreparation policy={moveIn} />);
    const row = await screen.findByRole("checkbox", { name: /자격 조건 확인/ });
    expect(row.closest("label")?.textContent).toContain("전입 전 1년 이상 다른 시·군·구에 주민등록");
  });

  it("안내 문구 세 개를 두지 않는다 — 기기 저장 안내 · '제출 전 다시 확인' 상자 · 신청 위치 한 줄 (11/17)", async () => {
    render(<ApplicationPreparation policy={policy} />);
    await screen.findByRole("heading", { level: 1, name: "필수 확인 사항을 점검해요" });
    expect(screen.queryByText(/확인한 항목은 이 기기에 저장되어/)).toBeNull();
    expect(screen.queryByText("제출 전 다시 확인해 주세요")).toBeNull();
    expect(screen.queryByText(/신청 위치 ·/)).toBeNull();
  });

  it("실제 정책 기간을 보여주고 확인 상태를 정책별로 저장한다", async () => {
    const user = userEvent.setup();
    render(<ApplicationPreparation policy={policy} />);

    // 2026년 회차: 2026-01-02 공고 ~ 2026-05-14 예산 소진 마감 (2026-11-03 원문 재대조)
    expect(screen.getByText("2026.01.02 ~ 2026.05.14")).toBeTruthy();
    const eligibility = screen.getByRole("checkbox", { name: /자격 조건 확인/ });
    expect(eligibility.getAttribute("aria-checked")).toBeNull();

    await user.click(eligibility);
    expect((eligibility as HTMLInputElement).checked).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(`perky.application-checklist:${policy.id}`) ?? "{}")
    ).toMatchObject({ eligibility: true });
  });

  it("외부 이동 전 출처와 실제 확인일을 안내하고 실제 applyUrl로 연결한다", async () => {
    const user = userEvent.setup();
    render(<ApplicationPreparation policy={policy} />);

    await user.click(screen.getByRole("button", { name: "공식 신청 사이트로 이동" }));
    const dialog = screen.getByRole("dialog", { name: "외부 사이트로 이동할게요" });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(policy.agency)).toBeTruthy();
    expect(screen.getByText(policy.verifiedAt ? policy.verifiedAt.replaceAll("-", ".") : "제공 정보 없음")).toBeTruthy();

    const external = screen.getByRole("link", { name: /공식 사이트로 이동/ });
    expect(document.activeElement).toBe(external);
    expect(external.getAttribute("href")).toBe(policy.applyUrl);
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toContain("noopener");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "공식 신청 사이트로 이동" }));
  });

  it("확인일이 없으면 임의 날짜 대신 fallback을 표시한다", async () => {
    const user = userEvent.setup();
    render(<ApplicationPreparation policy={{ ...policy, verifiedAt: null }} />);

    await user.click(screen.getByRole("button", { name: "공식 신청 사이트로 이동" }));
    expect(screen.getByText("제공 정보 없음")).toBeTruthy();
  });
});

describe("이동 모달의 문의처", () => {
  it("contact 가 있으면 모달에 문의 전화가 보인다", async () => {
    const withContact = { ...policy, contact: { department: "익산시 청년정책과", phone: "063-859-5745", url: null, phoneCheckedAt: null } };
    render(<ApplicationPreparation policy={withContact} />);
    await userEvent.click(screen.getByRole("button", { name: "공식 신청 사이트로 이동" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /063-859-5745/ })).toBeTruthy();
  });

  it("contact 가 없으면 문의 줄이 없다", async () => {
    render(<ApplicationPreparation policy={{ ...policy, contact: null }} />);
    await userEvent.click(screen.getByRole("button", { name: "공식 신청 사이트로 이동" }));
    expect(within(screen.getByRole("dialog")).queryByText(/^문의/)).toBeNull();
  });
});

describe("서류 목록이 있는 정책 (11/17)", () => {
  const id = "youth-housing-benefit-split-payment";
  const withDocs = {
    ...(policiesJson as PolicyMeta[]).find((p) => p.id === id)!,
    documents: [{ name: "임대차계약서 사본", note: "확정일자 포함" }, { name: "주민등록등본" }],
  } as PolicyMeta;

  beforeEach(() => window.localStorage.clear());

  it("자격 · 기간 + 서류 하나하나, '준비 서류 확인' 줄은 없다", async () => {
    render(<ApplicationPreparation policy={withDocs} />);
    expect(await screen.findByText("임대차계약서 사본")).toBeTruthy();
    expect(screen.getByText("확정일자 포함")).toBeTruthy();
    expect(screen.queryByText("준비 서류 확인")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("0 / 4 확인");
  });

  it("서류를 체크하면 perky.document-checks:<id> 에 저장되고 진행률이 오른다", async () => {
    const user = userEvent.setup();
    render(<ApplicationPreparation policy={withDocs} />);
    await user.click(await screen.findByRole("checkbox", { name: /주민등록등본/ }));
    expect(JSON.parse(window.localStorage.getItem(`perky.document-checks:${id}`)!)).toEqual(["주민등록등본"]);
    expect(screen.getByRole("status").textContent).toBe("1 / 4 확인");
  });

  it("옛 서류 이름은 체크할 때 버리고, 남은 이름은 서류 목록 순서로 저장한다", async () => {
    window.localStorage.setItem(`perky.document-checks:${id}`, JSON.stringify(["옛 서류", "주민등록등본"]));
    const user = userEvent.setup();
    render(<ApplicationPreparation policy={withDocs} />);
    await user.click(await screen.findByRole("checkbox", { name: /임대차계약서 사본/ }));
    expect(JSON.parse(window.localStorage.getItem(`perky.document-checks:${id}`)!)).toEqual([
      "임대차계약서 사본",
      "주민등록등본",
    ]);
  });

  it("note 가 없는 서류에는 설명 줄을 만들어 내지 않는다", async () => {
    render(<ApplicationPreparation policy={withDocs} />);
    await screen.findByText("주민등록등본");
    expect(screen.queryByText("공고 원문 기준")).toBeNull();
  });
});
