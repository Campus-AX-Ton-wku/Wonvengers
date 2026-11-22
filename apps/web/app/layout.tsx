import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ENTRY_SCRIPT } from "@/lib/entry";
import { START_REDIRECT } from "@/lib/start-redirect";
import { APPLE_SPLASH, SPLASH_SCRIPT } from "@/lib/splash";
import { SplashGate } from "@/app/components/SplashGate";
import { ThemeWatcher } from "@/app/components/ThemeWatcher";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import { contentSecurityPolicy } from "@/lib/csp";

/*
 * ── 이 앱의 디자인 계약 (2026-09-02 전면 리디자인) ─────────────────────────
 *
 * THESIS
 *   흩어진 청년 주거 지원금을 찾아주는 탐험 가이드. 공공 안내문의 회색 표도,
 *   금융앱의 무표정한 파랑도 아니다 — 안내자가 있는 화면이다.
 *
 * OWN-WORLD
 *   Perky 의 몸 파랑(#1a6bef)이 액션·선택·링크·정보를 전부 갖는다. 받는 돈의 대표 금액은
 *   짙은 남색(#0a3a80 글씨 / #eef4ff 면 — 11/20 금색에서 바꿈). 지면은 아주 옅은
 *   블루(#f4f8ff), 카드는 흰색 + 낮고 넓은 남색 그림자. 모서리 16/20px.
 *   아이콘은 lucide outline 한 벌, 제목은 Pretendard 800 두 줄 이내.
 *   콘텐츠를 다 지워도 이 셋(파랑 액션 · 남색 금액 · 옅은 파란 지면)으로 알아본다.
 *
 * STORY
 *   "내가 받을 수 있는 게 있긴 한가?" 로 들어와, 질문 넷에 답하고, 금액 한 줄과
 *   신청 페이지 링크를 들고 나간다. 앱 안에서 신청은 끝나지 않는다.
 *
 * FIRST VIEWPORT (랜딩)
 *   지면 위 큰 Perky(wave), 그 아래 워드마크와 두 줄 제목, 화면 폭을 다 쓴 파란
 *   CTA '내 혜택 찾아보기'. 장식 없음. 루트로 진입하면 온보딩 3장을 먼저 본다.
 *
 * FORM
 *   브리프가 지정한 방향(Perky 캐릭터 세계 + 의미 기반 토큰 + 온보딩 3단계).
 *   방향이 이미 고정돼 있어 컨셉 추첨은 돌리지 않았다.
 *
 * FINISH
 *   unreviewed and undocumented is unfinished; this build ends with the finish
 *   review, the verdict, DESIGN.md, and every shipping raster carrying its
 *   provenance.
 *
 * (React 는 주석 노드를 렌더하지 않아 이 계약은 소스에만 남는다. 이 파일이
 *  화면을 고칠 때마다 다시 열게 되는 파일이라 여기 둔다.)
 */

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
  title: "Perky · 청년 주거지원 실부담 계산기",
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
    /* 그리기 전 스크립트가 data-theme · style · splash class 를 단다 — React 불일치로 보지 않게 */
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
        {/* 배포 빌드에서만. dev 서버는 HMR 이 eval 을 써서 이 정책으로는 돌지 않는다. 스크립트보다 먼저 둔다. */}
        {process.env.NODE_ENV === "production" && (
          <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy()} />
        )}
        <meta name="theme-color" content={THEME_COLORS.light} />
        {/* 루트 리다이렉트는 lib/start-redirect.ts. 같은 스크립트가 이 탭의 첫 화면 기록 칸에 표도 단다
            (lib/entry.ts). 왼쪽 위 화살표가 "뒤로" 갈지 "정해 둔 상위 화면" 으로 갈지 정하는 표이고,
            React 가 뜨기 전에 달아야 첫 화면이 곧바로 replace(`/find` → `/find?q=birth`)돼도 놓치지 않는다. */}
        {/* 앱 시작 화면(lib/splash.ts)을 띄울지도 그리기 전에 정한다 — 맨 앞에 둔다(/ 에서 넘어가는 동안에도 파랑이 이어지게).
            테마를 맨 앞에 — 그리기 전에 색이 정해지게 */}
        <script dangerouslySetInnerHTML={{ __html: `${THEME_SCRIPT};${SPLASH_SCRIPT};${START_REDIRECT};${ENTRY_SCRIPT}` }} />
        {/* 아이폰 시작 이미지 — 기종 화면 크기와 정확히 같은 PNG 를 기종마다(scripts/build-apple-splash.mjs).
            apple-mobile-web-app-capable 이 있어야 아이폰이 시작 이미지를 쓴다(11/20, docs/기획/2026-11-20-앱-시작-화면-설계.md) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {APPLE_SPLASH.map(({ href, media }) => (
          <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
        ))}
      </head>
      <body className="min-h-dvh bg-canvas text-ink-900 antialiased">
        {/* 앱 시작 화면 — html.splash 일 때만 보인다(globals.css). 아이폰 시작 이미지와 같은 한 장: 파랑 + 정가운데 앱 아이콘 */}
        <div id="splash" role="status" aria-label="Perky를 여는 중">
          {/* eslint-disable-next-line @next/next/no-img-element -- 번들보다 먼저 그려져야 하는 정적 그림 */}
          <img src="/icon.png" alt="" width={150} height={150} />
          <p className="splash-slow">조금 오래 걸리고 있어요</p>
        </div>
        <SplashGate />
        <ThemeWatcher />
        {children}
      </body>
    </html>
  );
}
