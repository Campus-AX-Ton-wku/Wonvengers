// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ResultPage from "@/app/result/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import loanProducts from "@/data/loan-products.json";

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});

vi.mock("@/data/loan-products.json", async (orig) => {
  const real = ((await orig()) as { default: typeof loanProducts }).default;
  return {
    default: real.map((p) =>
      p.id === "iksan-youth-home-purchase-loan-interest"
        ? { ...p, contact: { department: "익산시 청년정책과", phone: "063-859-5745", url: null, phoneCheckedAt: null } }
        : p
    ),
  };
});

describe("결과 화면 대출 카드의 문의", () => {
  it("contact 가 있는 대출 상품은 카드에 문의 전화가 보인다", async () => {
    saveListing(makeListing({ contractType: "월세", rentOrYearlyAmount: 350000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByRole("heading", { level: 1 });
    const name = loanProducts.find((p) => p.id === "iksan-youth-home-purchase-loan-interest")!.name;
    const card = screen.getByText(name, { selector: "p" }).parentElement!;
    expect(within(card).getByRole("link", { name: /063-859-5745/ })).toBeTruthy();
  });
});
