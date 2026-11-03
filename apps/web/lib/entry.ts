/**
 * 이 탭에서 앱에 처음 들어온 주소. 왼쪽 위 화살표가 "뒤로" 갈지 "정해 둔 상위 화면" 으로
 * 갈지 가르는 기준이다 (docs/기획/2026-11-03-단계-이동-설계.md "왼쪽 위 화살표 = 뒤로가기").
 *
 * 이 파일은 React 를 import 하지 않는다. 서버 컴포넌트인 app/layout.tsx 가 ENTRY_SCRIPT 를
 * 가져가는데, 같은 파일에 훅 import 가 있으면 Next 가 서버 그래프에서 막는다.
 */

export const ENTRY_KEY = "perky.entry";

/**
 * <head> 인라인 스크립트. 전체 로드 때마다 React 보다 먼저 돈다.
 *
 * - 이미 적혀 있으면 덮지 않는다. 새로고침해도 sessionStorage 와 브라우저 기록이 함께
 *   남으므로 판정이 그대로 유지된다.
 * - "/" 는 적지 않는다. 바로 앞의 ONBOARDING_REDIRECT 가 /onboarding 으로 location.replace
 *   하고, 그 로드에서 /onboarding 이 적힌다.
 * - 저장소가 막혀 있으면 조용히 넘어간다. isEntryPage 가 그 경우를 첫 화면으로 본다.
 */
export const ENTRY_SCRIPT = `try{if(location.pathname!=="/"&&!sessionStorage.getItem("${ENTRY_KEY}")){sessionStorage.setItem("${ENTRY_KEY}",location.pathname+location.search)}}catch(e){}`;

/** 기록과 비교하는 형태의 지금 주소. 경로 + 쿼리(브라우저가 인코딩한 그대로). */
export function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

/**
 * 지금 화면이 이 탭의 첫 화면인가.
 *
 * 기록이 없거나 저장소가 막혀 있으면 첫 화면으로 본다. history.back() 으로 앱 밖에
 * 튕기는 것보다 정해 둔 상위 화면으로 가는 편이 안전하다.
 */
export function isEntryPage(): boolean {
  try {
    const entry = window.sessionStorage.getItem(ENTRY_KEY);
    return entry === null || entry === currentUrl();
  } catch {
    return true;
  }
}

/**
 * replace 는 기록을 늘리지 않는다. 첫 화면에서 replace 하면 바뀐 주소가 여전히 첫 화면이라
 * 기록도 따라 옮긴다. 안 옮기면 /find → /find?q=birth 로 바뀐 순간 첫 화면을 잃고, 첫 질문의
 * 화살표가 history.back() 으로 앱 밖에 나간다.
 */
export function moveEntryOnReplace(to: string): void {
  try {
    if (window.sessionStorage.getItem(ENTRY_KEY) === currentUrl()) {
      window.sessionStorage.setItem(ENTRY_KEY, to);
    }
  } catch {
    // 저장소가 막혀 있으면 isEntryPage 가 늘 첫 화면으로 본다. 옮길 것이 없다.
  }
}
