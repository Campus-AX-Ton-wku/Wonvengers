// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalculatePage from "@/app/calculate/page";
import EligibilityPage from "@/app/eligibility/page";
import ResultPage from "@/app/result/page";
import { EMPTY_ANSWERS, loadListing, saveAnswers, saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));
vi.mock("next/navigation", () => {
  const router = { push: pushMock, replace: replaceMock };
  return { useRouter: () => router };
});

/**
 * 사용자 흐름 검토의 P2 세 건.
 *
 * 1. 결과 화면이 저장된 입력 없이 열리면 이유도 없이 홈으로 튕겼다.
 * 2. 금액 칸이 0 으로 채워져 있어 지우고 입력해야 했다.
 * 3. 계약 형태 기본값이 '연세' 였다. 월세 계약자가 그대로 두면 월 환산액이
 *    1/12 로 줄어 지원금이 크게 어긋난다 (PRD F1-1 은 '선택하게 한다').
 */

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  // 1층 답변이 테스트끼리 새지 않게 비운다 — 계약 형태 이어받기가 순서에 따라
  // 켜졌다 꺼졌다 하면 무엇을 검증한 것인지 알 수 없다.
  saveAnswers(EMPTY_ANSWERS);
});

describe("입력 없이 결과 화면에 들어왔을 때", () => {
  it("홈으로 튕기지 않고, 왜 볼 수 없는지 알려준다", async () => {
    render(<ResultPage />);

    expect(await screen.findByText(/계산할 계약 조건이 없어요/)).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("계약 조건 입력으로 가는 길을 준다", async () => {
    render(<ResultPage />);
    await screen.findByText(/계산할 계약 조건이 없어요/);

    expect(screen.getByRole("link", { name: /계약 조건 입력하기/ }).getAttribute("href")).toBe(
      "/calculate"
    );
    expect(screen.getByRole("link", { name: /지원금 목록/ }).getAttribute("href")).toBe(
      "/find/policies"
    );
  });

  it("판정 질문 화면은 필요한 입력을 받는 곳으로 보낸다", async () => {
    render(<EligibilityPage />);
    // 계약 조건이 없으면 판정할 수 없다 — 홈이 아니라 계약 조건 화면으로 보낸다
    expect(replaceMock).toHaveBeenCalledWith("/calculate");
  });
});

describe("계약 형태", () => {
  it("기본으로 아무것도 선택돼 있지 않다", () => {
    render(<CalculatePage />);

    for (const type of ["월세", "연세"]) {
      const button = screen.getByRole("button", { name: type });
      expect(button.getAttribute("aria-pressed"), type).toBe("false");
    }
  });

  /*
   * 1층에서 이미 '월세'·'연세'를 답한 사람에게 같은 질문을 다시 하지 않는다.
   *
   * 기본값을 켜 두는 것과 다르다 — 사용자가 직접 고른 답을 옮기는 것이라
   * F1-1 의 '고르게 한다' 를 어기지 않는다. 옮겼다는 사실은 화면에 밝힌다.
   */
  it("1층에서 답한 주거 형태를 계약 형태로 이어받는다", () => {
    saveAnswers({ ...EMPTY_ANSWERS, housingType: "연세" });
    render(<CalculatePage />);

    expect(screen.getByRole("button", { name: "연세" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "월세" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(/앞에서 답한 주거 형태로 골랐어요/)).toBeTruthy();
  });

  // 전세·그 외는 이 화면이 다루는 계약이 아니다. 둘 중 하나로 단정하면 월 환산액이
  // 통째로 틀어진다 — 기본값을 두지 않는 이유와 같다.
  it("전세·그 외는 계약 형태로 옮기지 않는다", () => {
    saveAnswers({ ...EMPTY_ANSWERS, housingType: "전세" });
    render(<CalculatePage />);

    for (const type of ["월세", "연세"]) {
      expect(screen.getByRole("button", { name: type }).getAttribute("aria-pressed"), type).toBe(
        "false"
      );
    }
    expect(screen.queryByText(/앞에서 답한 주거 형태로 골랐어요/)).toBeNull();
  });

  it("고르지 않고 다음을 누르면 넘어가지 않고 이유를 말한다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 익산시");
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText(/계약 형태를 선택해주세요/)).toBeTruthy();
  });

  it("저장된 입력을 불러오면 그 계약 형태가 선택된 상태다", () => {
    saveListing(makeListing({ contractType: "월세" }));
    render(<CalculatePage />);

    expect(screen.getByRole("button", { name: "월세" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("금액 칸", () => {
  it("0 은 빈 칸으로 보여준다 — 지우고 입력하지 않게", () => {
    render(<CalculatePage />);

    const 보증금 = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    expect(보증금.value).toBe("");
    expect(보증금.getAttribute("placeholder")).toBe("0");
  });

  it("월세·연세 금액을 비워두면 다음으로 넘어가지 않는다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 익산시");
    await user.click(screen.getByRole("button", { name: "월세" }));
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText(/월세액을 입력해주세요/)).toBeTruthy();
  });

  it("보증금은 0 이어도 넘어간다 — 무보증 계약이 있다", async () => {
    const user = userEvent.setup();
    render(<CalculatePage />);

    await user.selectOptions(screen.getByRole("combobox"), "전북특별자치도 익산시");
    await user.click(screen.getByRole("button", { name: "월세" }));
    await user.type(screen.getAllByRole("spinbutton")[1], "35"); // 만원 단위
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.queryByText(/입력해주세요/)).toBeNull();
    expect(loadListing()?.deposit).toBe(0);
  });
});

describe("결과 화면은 입력이 있으면 그대로 계산한다", () => {
  it("계약 조건과 답변이 있으면 금액을 보여준다", async () => {
    saveListing(makeListing({ contractType: "월세", rentOrYearlyAmount: 350000, months: 12 }));
    saveProfile(makeProfile());
    render(<ResultPage />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByText(/계산할 계약 조건이 없어요/)).toBeNull();
  });
});
