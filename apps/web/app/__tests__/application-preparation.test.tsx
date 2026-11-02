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
