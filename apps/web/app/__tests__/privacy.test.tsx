// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";

describe("/privacy — 처리방침 초안 (설계 '화면' 6)", () => {
  it("초안임을 먼저 밝히고, 수집 항목·목적·보관 기간·처리 위탁·파기 절차·문의처를 담는다", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("개인정보 처리방침 (초안)");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "1. 수집하는 항목",
      "2. 이용 목적",
      "3. 보관 기간",
      "4. 처리 위탁",
      "5. 파기 절차",
      "6. 이용자의 권리",
      "7. 문의처",
    ]);
    const text = document.body.textContent ?? "";
    for (const phrase of [
      "정식 공개 전 팀·학교 검토",
      "로그인하지 않으면 고른 답을 서버에 보내지 않아요",
      "마지막 저장 후 1년",
      "AWS 서울 리전",
      "Amazon Web Services, Inc.",
      "카카오 연결 끊기",
      "확인 필요",
    ]) {
      expect(text).toContain(phrase);
    }
  });
});
