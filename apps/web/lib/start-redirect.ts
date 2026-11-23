/*
 * 루트 방문자를 보낼 곳을 정하는 스크립트. React 가 뜨기 전에 실행된다.
 *
 * useEffect 로 하면 랜딩이 한 프레임 그려진 뒤 화면이 갈아치워진다 — 깜빡임이
 * 고장으로 읽힌다. <head> 앞에서 동기 실행하면 페인트 전에 이동한다
 * (다크모드 플래시를 막는 것과 같은 방법).
 *
 * 이 스크립트가 실패해도 앱은 멀쩡하다: JavaScript가 꺼져 있으면 랜딩이 뜬다.
 *
 * 조건이 pathname === "/" 인 이유: 목록·결과 링크로 바로 들어온 사람을 온보딩으로
 * 끌고 가면 자기가 열려던 화면을 못 본다.
 *
 * 11/17: 로그인 기록(perky.auth)이 있으면 홈으로. perky.auth 는 lib/auth.ts 의 AUTH_KEY 다 —
 * 이 스크립트는 번들보다 먼저 돌아서 import 없이 문자열을 그대로 쓴다. 값이 있으면 만료 여부는 보지 않고
 * 홈으로 보낸다(홈이 알아서 처리한다). 저장소가 막혀 있으면 온보딩.
 *
 * 11/20: 소개를 이미 본 비회원(perky.onboarded = lib/storage.ts 의 ONBOARDED_KEY)은 /start — 소개 마지막 장인 시작 화면
 * ([내 혜택 찾아보기] · [카카오로 로그인])부터. 예전에는 앱을 열 때마다 소개 1장부터 다시 봤다.
 *
 * 11/23 ggue: 되돌림 — 비회원은 소개를 봤어도 늘 1장부터("앱을 처음 여니까 3번째 페이지에서 시작한다").
 * 소개가 저절로 넘어가고([다음] 없음) 오른쪽 위 [건너뛰기]가 있어 회원도 금방 로그인 버튼에 닿는다.
 * 홈에서 로그인이 풀린 경우만 /start(마지막 장)로 간다(app/home/page.tsx) — 앱을 연 게 아니라 쓰던 중이라서.
 */
export const START_REDIRECT = `if(location.pathname==="/"){var a=null;try{a=localStorage.getItem("perky.auth")}catch(e){}location.replace(a?"/home":"/onboarding")}`;
