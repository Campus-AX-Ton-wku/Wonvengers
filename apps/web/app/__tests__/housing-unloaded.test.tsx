// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// 빌드 때 공고를 못 받으면 Vercel 은 커밋된 빈 스냅숏(generatedAt: null)으로 배포한다 — 이건 '없음'이 아니라 '모름'이다 (리뷰 I-2)
vi.mock("@/data/notices.json", () => ({ default: { generatedAt: null, notices: [] } }));

import HousingPage from "@/app/housing/page";

describe("/housing — 공고를 아직 못 받았을 때", () => {
  it("'공고가 없어요'라고 단정하지 않고, 불러오지 못했다고 말한 뒤 마이홈포털로 보낸다", async () => {
    render(<HousingPage />);
    expect(await screen.findByText("공고를 아직 불러오지 못했어요")).toBeTruthy();
    expect(screen.queryByText(/접수 중인 청약 공고가 없어요/)).toBeNull();
    expect(screen.getByRole("link", { name: /마이홈포털에서 보기/ }).getAttribute("href")).toBe("https://www.myhome.go.kr/");
  });
});
