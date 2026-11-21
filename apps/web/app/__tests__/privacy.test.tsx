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
      "4. 처리 위탁 · 국외 이전",
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
      // 11/20 팀 결정 — 보호책임자 · 문의처 · 시행일, Vercel 국외 이전
      "개인정보 보호책임자: 이병규",
      "iggue2411@gmail.com",
      "시행일: 2026년 11월 22일",
      "Vercel Inc.",
      "국외 이전(Vercel)",
      // 11/20 연결 해제 웹훅 — 카카오 쪽에서 끊어도 바로 지운다
      "카카오 쪽에서 먼저 연결을 끊어도",
      "알림 구독 정보",
      "관심 지원금",
      "정책 이름만 들어가고 고른 답은 넣지 않아요",
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it("지도 위치는 기기 안에서만 · 카카오맵 연동을 적는다 (11/22)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/'내 위치'를 누르면 기기 위치를 지도 가운데를 맞추고 거리를 재는 데만 써요/)).toBeTruthy();
    expect(screen.getByText(/연동 서비스 — 카카오맵/)).toBeTruthy();
  });
});
