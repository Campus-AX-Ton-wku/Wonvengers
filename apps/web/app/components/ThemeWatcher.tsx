"use client";

import { useEffect } from "react";
import { THEME_CHANGE_EVENT, THEME_KEY, applyTheme, onSystemThemeChange } from "@/lib/theme";

/**
 * 그린 뒤의 테마 바뀜을 따라간다(그리기 전은 layout <head> 의 THEME_SCRIPT).
 * 기기 다크 설정 바뀜 · 다른 탭에서 고름(storage) · 이 탭에서 고름(THEME_CHANGE_EVENT). 화면에는 아무것도 그리지 않는다.
 */
export function ThemeWatcher() {
  useEffect(() => {
    const reapply = () => applyTheme();
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) reapply();
    };
    const offSystem = onSystemThemeChange(reapply);
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, reapply);
    return () => {
      offSystem();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, reapply);
    };
  }, []);
  return null;
}
