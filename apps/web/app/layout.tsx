import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * ── 이 앱의 디자인 계약 (2026-09-02 전면 리디자인) ─────────────────────────
 *
 * THESIS
 *   흩어진 청년 주거 지원금을 찾아주는 탐험 가이드. 공공 안내문의 회색 표도,
 *   금융앱의 무표정한 파랑도 아니다 — 안내자가 있는 화면이다.
 *
 * OWN-WORLD
 *   Perky 의 몸 파랑(#1a6bef)이 액션·선택·링크·정보를 전부 갖는다. 모자와 동전의
 *   금색(#8a5a00 글씨 / #fff6e0 면)은 금액에만 붙는다. 지면은 아주 옅은
 *   블루(#f4f8ff), 카드는 흰색 + 낮고 넓은 남색 그림자. 모서리 16/20px.
 *   아이콘은 lucide outline 한 벌, 제목은 Pretendard 800 두 줄 이내.
 *   콘텐츠를 다 지워도 이 셋(파랑 액션 · 금색 금액 · 옅은 파란 지면)으로 알아본다.
 *
 * STORY
 *   "내가 받을 수 있는 게 있긴 한가?" 로 들어와, 질문 넷에 답하고, 금액 한 줄과
 *   신청 페이지 링크를 들고 나간다. 앱 안에서 신청은 끝나지 않는다.
 *
 * FIRST VIEWPORT (랜딩)
 *   지면 위 큰 Perky(wave), 그 아래 워드마크와 두 줄 제목, 화면 폭을 다 쓴 파란
 *   CTA '내 혜택 찾아보기'. 장식 없음. 첫 방문자는 이 화면 전에 온보딩 3장을 본다.
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

/**
 * 첫 방문자를 온보딩으로 보내는 스크립트. React 가 뜨기 전에 실행된다.
 *
 * useEffect 로 하면 랜딩이 한 프레임 그려진 뒤 화면이 갈아치워진다 — 깜빡임이
 * 고장으로 읽힌다. <head> 앞에서 동기 실행하면 페인트 전에 이동한다
 * (다크모드 플래시를 막는 것과 같은 방법).
 *
 * 이 스크립트가 실패해도 앱은 멀쩡하다: JS 가 꺼져 있거나 localStorage 가 막혀
 * 있으면 그냥 랜딩이 뜬다. 온보딩은 없으면 아쉬운 것이지 없으면 못 쓰는 것이 아니다.
 *
 * 조건이 pathname === "/" 인 이유: 목록·결과 링크로 바로 들어온 사람을 온보딩으로
 * 끌고 가면 자기가 열려던 화면을 못 본다.
 *
 * 키 문자열은 lib/storage.ts 의 ONBOARDED_KEY 와 같아야 한다. 이 스크립트는
 * 번들보다 먼저 돌아야 해서 모듈을 import 할 수 없다.
 */
const ONBOARDING_REDIRECT = `try{
if(location.pathname==="/"&&!localStorage.getItem("perky.onboarded")){location.replace("/onboarding")}
}catch(e){}`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: ONBOARDING_REDIRECT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink-900 antialiased">{children}</body>
    </html>
  );
}
