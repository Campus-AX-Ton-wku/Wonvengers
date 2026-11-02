// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactInfo, telHref } from "@/app/components";

const contact = {
  department: "익산시 청년정책과",
  phone: "063-859-5745",
  url: "https://www.iksan.go.kr/youth",
  phoneCheckedAt: "2026-11-05",
};

describe("ContactInfo", () => {
  it("null 이면 아무것도 그리지 않는다 — 없는 연락처를 빈 칸으로 보여주지 않는다", () => {
    const { container } = render(<ContactInfo contact={null} variant="block" />);
    expect(container.innerHTML).toBe("");
  });

  it("전화번호는 누르면 걸리는 tel: 링크다", () => {
    render(<ContactInfo contact={contact} variant="block" />);
    const link = screen.getByRole("link", { name: /063-859-5745/ });
    expect(link.getAttribute("href")).toBe("tel:0638595745");
  });

  it("block 은 부서와 문의 페이지 링크를 함께 보여준다", () => {
    render(<ContactInfo contact={contact} variant="block" />);
    expect(screen.getByText("익산시 청년정책과")).toBeTruthy();
    expect(screen.getByRole("link", { name: /문의 페이지/ }).getAttribute("href")).toBe(contact.url);
  });

  it("번호가 없으면 부서만 보여주고 전화 링크를 만들지 않는다", () => {
    render(<ContactInfo contact={{ ...contact, phone: null, phoneCheckedAt: null }} variant="block" />);
    expect(screen.getByText("익산시 청년정책과")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^문의 전화/ })).toBeNull();
  });

  it("inline 은 '문의' 한 줄이다", () => {
    render(<ContactInfo contact={contact} variant="inline" />);
    expect(screen.getByText(/^문의/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /063-859-5745/ })).toBeTruthy();
  });

  it("telHref 는 하이픈을 뗀다", () => {
    expect(telHref("1600-1004")).toBe("tel:16001004");
  });
});
