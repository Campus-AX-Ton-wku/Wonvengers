import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트. 홈 화면에 추가했을 때 쓸 이름·아이콘·색을 알려준다.
 *
 * 정적 export 라 빌드 시점에 파일로 굽힌다. Next 가 <link rel="manifest"> 도 함께 넣는다.
 *
 * maskable 아이콘을 따로 두는 이유: 안드로이드는 아이콘을 기기 테마에 맞춰 원형·
 * 스퀴클로 깎는다. 마스터의 `p` 는 위아래 끝이 안전원(지름 61.1%) 밖으로 나가서
 * 그대로 쓰면 깎인다. maskable 파일은 마크를 85% 로 줄여 구운 것이다.
 * (docs/디자인/아이콘/README.md 의 측정값 참고)
 */
/* output: "export" 에서는 메타데이터 라우트도 정적으로 굽는다고 명시해야 한다.
   없으면 빌드가 "force-static 이 설정되지 않았다"며 실패한다. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Perky · 청년 주거지원 실부담 계산기",
    short_name: "Perky",
    description:
      "계약 조건을 입력하면 청년 주거지원 정책을 판정하고 최종 예상 주거비를 계산합니다.",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    /* 브라우저 UI 색. brand-600 — 앱의 기본 액션색과 같은 값을 쓴다. */
    theme_color: "#1a6bef",
    /* 안드로이드 기기 스플래시 바탕. 앱 아이콘 바탕 · 웹 시작 화면(globals.css #splash) · 아이폰 시작 이미지와 같은 파랑이라
       기기 화면에서 웹 화면으로 넘어가도 바뀌는 게 없다 (11/20, docs/기획/2026-11-20-앱-시작-화면-설계.md). */
    background_color: "#1a6bef",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      /* app/icon.png 이 /icon.png 로 나가므로 512 를 따로 두지 않는다 (같은 파일 중복). */
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
