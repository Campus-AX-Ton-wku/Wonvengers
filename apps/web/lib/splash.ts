import devices from "./apple-splash.json";

/*
 * 앱 시작 화면(스플래시) — docs/기획/2026-11-20-앱-시작-화면-설계.md
 *
 * 기기 화면 · 아이폰 시작 이미지 · 웹 스플래시를 똑같은 한 장(파랑 #1a6bef + 정가운데 앱 아이콘)으로 맞춘다.
 * 문구 · 움직임이 없어 기기가 그린 화면에서 웹 화면으로 넘어가도 아무것도 바뀌지 않는다.
 *
 * 띄우는 때: 홈 화면 앱으로 시작 주소를 열 때, 한 번 열린 동안 한 번.
 *  - <head> 의 SPLASH_SCRIPT 가 그리기 전에 html.splash 를 단다(START_REDIRECT 와 같은 방식)
 *  - 걷는 것은 SplashGate(최소 1.4초 보인 뒤 0.3초 흐려짐). sessionStorage 에 '본 적 있음'을 적는다
 */

/** 이번 실행에 시작 화면을 봤다 — sessionStorage (앱을 완전히 닫으면 지워진다) */
export const SPLASH_LAUNCHED_KEY = "perky.launched";

/** 시작 주소 — 매니페스트 start_url(/) 과 / 가 보내는 곳(lib/start-redirect.ts). 알림 · 로그인 복귀 같은 다른 입구는 띄우지 않는다 */
export const LAUNCH_PATHS = ["/", "/home", "/start", "/onboarding"] as const;

/**
 * 최소로 보여 주는 시간(문서를 연 때부터). 처음엔 '준비되면 바로' 걷었는데 이 앱은 0.3초 안팎에 떠서
 * 아이폰에서 알아보기 어려울 만큼 스쳐 지나갔다 — 다른 앱들처럼 1초는 보이게 (ggue 11/21).
 * 1초도 아직 짧다 — 1.4초로 조금 늘림 (ggue 11/22)
 */
export const SPLASH_MIN_MS = 1400;
/** 걷을 때 흐려지는 시간 */
export const SPLASH_FADE_MS = 300;

/**
 * 번들보다 먼저 도는 인라인 스크립트라 import 없이 값을 글자로 박는다(테스트가 상수와 같은지 본다).
 * 저장소가 막혀 있거나 무엇이든 실패하면 띄우지 않는다 — 시작 화면이 없어도 앱은 멀쩡하다.
 */
export const SPLASH_SCRIPT = `try{var p=location.pathname.replace(/\\/+$/,"")||"/";if(${JSON.stringify(
  LAUNCH_PATHS
)}.indexOf(p)>=0&&(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)&&!sessionStorage.getItem(${JSON.stringify(
  SPLASH_LAUNCHED_KEY
)}))document.documentElement.classList.add("splash")}catch(e){}`;

/**
 * 아이폰 시작 이미지 — 기종 화면 크기와 정확히 같은 PNG 를 기종마다 따로 줘야 뜬다(data URL 은 iOS 17.6+ 에서 안 됨).
 * 파일은 scripts/build-apple-splash.mjs 가 같은 목록(lib/apple-splash.json)으로 굽는다.
 */
export const APPLE_SPLASH: { href: string; media: string }[] = (devices as { w: number; h: number; dpr: number }[]).map(
  ({ w, h, dpr }) => ({
    href: `/splash/apple-splash-${w * dpr}x${h * dpr}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
  })
);
