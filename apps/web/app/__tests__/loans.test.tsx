// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import loanProductsData from "@/data/loan-products.json";
import LoansPage from "@/app/loans/page";
import LoanPage, { generateStaticParams } from "@/app/loans/[id]/page";
import { formatDotDate } from "@/lib/date";
import { loanMetaLine } from "@/lib/loans";
import { saveAnswers } from "@/lib/storage";
import type { LoanProductMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";

const products = loanProductsData as LoanProductMeta[];
const NOTICE = "현금 지원이 아니라서 지원금 합계에는 넣지 않아요. 이자 절감액은 계산하지 않아요.";

beforeEach(() => window.localStorage.clear());

describe("/loans — 대출 · 보증 전체", () => {
  it("답이 없으면 전부 데이터 순서, 카드는 이름 · 종류 · 지역, 누르면 상세", () => {
    render(<LoansPage />);
    expect(screen.getByRole("heading", { level: 1, name: "대출 · 보증" })).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(products.map((p) => `/loans/${p.id}`));
    expect(within(links[0]).getByText(products[0].name)).toBeTruthy();
    expect(within(links[0]).getByText(loanMetaLine(products[0]))).toBeTruthy();
    expect(links[0].querySelector("img[data-icon3d]")?.getAttribute("data-icon3d")).toBe(products[0].icon);
  });

  it("이 기기의 답이 전세면 버팀목 전세가 맨 앞 + '전세라면 먼저'", async () => {
    saveAnswers({ birthDate: birthDateForAge(25), region: "전북특별자치도 익산시", status: "재직", incomeBracket: 1, housingType: "전세" });
    render(<LoansPage />);
    await screen.findByText("전세라면 먼저");
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/loans/youth-btm-jeonse-loan");
    expect(within(links[0]).getByText("전세라면 먼저")).toBeTruthy();
  });
});

describe("/loans/[id] — 상품 한 장", () => {
  it("상품마다 미리 만든다", () => {
    expect(generateStaticParams()).toEqual(products.map((p) => ({ id: p.id })));
  });

  it("이름 · 기관 · 종류 · 지역 · 확인일, 조건 문단 그대로, 안내, 신청 링크(새 창), 문의 전화", async () => {
    const p = products.find((x) => x.id === "iksan-youth-jeonse-loan-interest")!;
    render(await LoanPage({ params: Promise.resolve({ id: p.id }) }));
    expect(screen.getByRole("heading", { level: 1, name: p.name })).toBeTruthy();
    expect(screen.getByText(p.agency)).toBeTruthy();
    expect(screen.getByText(`${loanMetaLine(p)} · ${formatDotDate(p.verifiedAt!)} 확인`)).toBeTruthy();
    const terms = screen.getByRole("region", { name: "조건" });
    expect(within(terms).getByText(p.summary)).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    const apply = screen.getByRole("link", { name: /신청 페이지로 이동/ });
    expect(apply.getAttribute("href")).toBe(p.applyUrl);
    expect(apply.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: `문의 전화 ${p.contact!.phone}` })).toBeTruthy();
  });

  it("공식 출처가 신청 링크와 같으면 링크를 두 번 두지 않는다 (11/22 데이터는 8건 모두 같다)", async () => {
    const p = products.find((x) => x.sourceUrl === x.applyUrl)!;
    render(await LoanPage({ params: Promise.resolve({ id: p.id }) }));
    expect(screen.queryByRole("link", { name: /공식 출처/ })).toBeNull();
  });

  it("없는 id 는 404", async () => {
    await expect(LoanPage({ params: Promise.resolve({ id: "nope" }) })).rejects.toThrow();
  });
});
