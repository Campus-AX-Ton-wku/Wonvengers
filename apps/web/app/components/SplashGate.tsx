"use client";

import { useEffect } from "react";
import { SPLASH_FADE_MS, SPLASH_LAUNCHED_KEY, SPLASH_MIN_MS } from "@/lib/splash";

/**
 * 앱 시작 화면을 걷는다 (docs/기획/2026-11-20-앱-시작-화면-설계.md "언제 걷나").
 *
 * 띄우는 건 <head> 의 SPLASH_SCRIPT(그리기 전), 걷는 건 여기. 문서를 연 지 최소 1.4초(SPLASH_MIN_MS)는 보여 주고
 * 0.3초 흐려지며 걷는다 — 처음엔 '준비되면 바로' 걷었더니 아이폰에서 스쳐 지나가 알아보기 어려웠다(ggue 11/21).
 * 이미 1.4초가 지났으면(느린 연결) 바로 흐려지기 시작한다. 움직임 줄이기면 흐려짐 없이 걷는다.
 *
 * `/` 에서는 아무것도 하지 않는다 — START_REDIRECT 가 다음 시작 주소로 넘기는 중이라, 여기서 걷거나 '봤다'고 적으면
 * 다음 문서가 시작 화면 없이 흰 바탕부터 그린다. 다음 문서가 이어서 보여 주고 걷는다.
 *
 * 루트 레이아웃에 한 번 있다. 앱 안 이동(클라이언트 내비게이션)은 레이아웃을 다시 그리지 않아 다시 돌지 않는다.
 */
export function SplashGate() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("splash") || window.location.pathname === "/") return;
    try {
      window.sessionStorage.setItem(SPLASH_LAUNCHED_KEY, "1");
    } catch {
      // 저장이 막혀도 걷기는 한다 — 다음에 다시 보일 뿐이다
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    let fade: number | undefined;
    const hold = window.setTimeout(() => {
      if (reduce) {
        root.classList.remove("splash");
        return;
      }
      root.classList.add("splash-out");
      fade = window.setTimeout(() => root.classList.remove("splash", "splash-out"), SPLASH_FADE_MS);
    }, Math.max(0, SPLASH_MIN_MS - performance.now()));
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(fade);
    };
  }, []);
  return null;
}
