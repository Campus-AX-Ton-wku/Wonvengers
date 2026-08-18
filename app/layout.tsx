import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perky · 청년 주거 지원금 모아보기",
  description:
    "흩어져 있는 청년 주거 지원금을 한 번에 확인하고, 받을 수 있는 금액과 실제 부담을 계산합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
