import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Pretendard 를 직접 싣는다.
 *
 * 전에는 globals.css 가 "Pretendard" 를 1순위로 지정하기만 했고 파일을 부르지
 * 않았다. 그래서 기기에 설치된 사람만 그 글꼴을 봤고, 나머지는 폴백을 봤다 —
 * 윈도우는 Malgun Gothic, 맥·iOS 는 Apple SD Gothic Neo, 안드로이드는 Noto.
 * 셋 다 멀쩡한 고딕이지만 자폭·굵기가 달라 같은 화면이 기기마다 다르게 읽혔고,
 * 발표 덱의 캡처와 심사위원 폰의 화면이 어긋났다.
 *
 * 파일 선택 — 상용 한글까지 남긴 가변 폰트 서브셋 (434KB):
 *  - 가변 폰트라 이 앱이 쓰는 400·500·600·700·800 을 한 파일로 덮는다.
 *    정적 웨이트로 같은 범위를 덮으면 5 × 748KB = 3.7MB 다.
 *  - 전체 글리프판은 2,009KB(한글 11,172자)다. 상용 한글(KS X 1001 2,350자)에서
 *    멈춘다. scripts/build-font-subset.py 가 만든다.
 *  - 앱이 실제로 렌더하는 한글은 600자뿐이고 그것만 담으면 144KB 까지 줄지만,
 *    그러면 한글 주석을 고칠 때마다 font-coverage 테스트가 실패한다. 재생성에
 *    fontTools·brotli 와 원본 2MB 가 필요해 도구가 없는 사람은 못 푼다.
 *    290KB 를 더 내고 그 상황을 없앤다.
 *  - 서브셋에 없는 글자는 폴백으로 그려져 문장 중간에서 글꼴이 갈린다. 이건
 *    에러가 안 나므로 lib/__tests__/font-coverage.test.ts 가 지킨다.
 *
 * (PretendardStd 를 쓰려다 되돌렸다 — 이름이 서브셋처럼 보이지만 한글 글리프가
 *  0자인 라틴 전용 판이다. 285KB 라 크기만 보고는 알 수 없었고, 시스템 한글
 *  폰트를 지우고 캡처해서야 두부가 드러났다.)
 *
 * display: "swap" — 폰트를 기다리며 글자를 감추지 않는다. 폴백으로 먼저 읽히고
 * 나중에 교체되는 편이, 첫 화면이 비는 것보다 낫다.
 */
const pretendard = localFont({
  src: "./fonts/Pretendard-subset.woff2",
  weight: "45 920", // 가변 폰트가 지원하는 웨이트 범위
  display: "swap",
  variable: "--font-pretendard",
  // 폴백은 그대로 남긴다. 폰트를 못 받는 상황에서도 한글이 읽혀야 한다.
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

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
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-screen bg-white text-ink-900">{children}</body>
    </html>
  );
}
