// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import policiesJson from "@/data/policies.json";
import RequirementReview from "@/app/result/review/[id]/RequirementReview";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import type { PolicyMeta } from "@/lib/types";

const policy = (policiesJson as PolicyMeta[]).find(
  (item) => item.id === "jeonse-return-guarantee-fee-subsidy",
)!;

describe("정책별 확인 필요 조건", () => {
  it("이미 확인된 공통 조건은 빼고 현재 확인이 필요한 3개와 확인 방법만 보여준다", async () => {
    saveListing(makeListing({ region: "서울특별시 광진구" }));
    saveProfile(makeProfile({ hasNoHouse: true, isContractHolder: true }));

    render(<RequirementReview policy={policy} />);

    expect(
      await screen.findByRole("heading", { name: "3가지 조건만 확인하세요" }),
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "확인 필요 조건 3개" }).children).toHaveLength(3);

    expect(screen.getByText("전세보증금반환보증 가입 및 보증료 납부")).toBeTruthy();
    expect(screen.getByText("임차보증금 3억원 이하")).toBeTruthy();
    expect(screen.getByText(/연소득 기준/)).toBeTruthy();
    expect(screen.getByText(/HUG·HF·SGI 중 한 곳에 가입한 보증서/)).toBeTruthy();
    expect(screen.getByText(/전세 계약서의 보증금을 확인하세요/)).toBeTruthy();
    expect(screen.getByText(/국세청 소득금액증명/)).toBeTruthy();

    expect(screen.queryByText("무주택 임차인")).toBeNull();
    expect(screen.queryByText("임대차계약 명의자 본인")).toBeNull();
    expect(
      screen
        .getAllByRole("link", { name: "결과로 돌아가기" })
        .every((link) => link.getAttribute("href") === "/result"),
    ).toBe(true);
  });
});
