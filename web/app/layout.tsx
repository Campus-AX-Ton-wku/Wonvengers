import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "청년 주거지원 실부담 계산기",
  description: "계약 조건을 입력하면 청년 주거지원 정책을 판정하고 최종 예상 주거비를 계산합니다.",
};

/* viewport-fit=cover 로 노치·홈 인디케이터 영역까지 지면을 넓히고,
   safe-area-inset 여백은 각 컴포넌트에서 준다. 확대는 접근성상 막지 않는다. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-ink-900">{children}</body>
    </html>
  );
}
