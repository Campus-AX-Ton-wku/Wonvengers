"use client";

import { useEffect, useState } from "react";
import { THEME_CHANGE_EVENT, loadThemeChoice, saveThemeChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "기기 설정" },
  { value: "light", label: "밝게" },
  { value: "dark", label: "어둡게" },
];

/**
 * 화면 모드 (docs/기획/2026-11-22-다크-모드-설계.md §3). 로그인과 상관없이 — 이 기기에만 저장한다.
 * 세 칸 중 하나를 누르는 버튼 묶음(aria-pressed). 고른 칸은 파랑 채움 + 굵게 — 색만으로 말하지 않는다.
 */
export function ThemeSetting() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const read = () => setChoice(loadThemeChoice());
    read();
    window.addEventListener(THEME_CHANGE_EVENT, read);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, read);
  }, []);

  return (
    <section aria-labelledby="theme-heading" className="flex flex-col gap-2.5">
      <h2 id="theme-heading" className="text-base font-bold text-ink-900">
        화면 모드
      </h2>
      <div role="group" aria-labelledby="theme-heading" className="grid grid-cols-3 gap-1 rounded-control bg-ink-100 p-1">
        {OPTIONS.map((option) => {
          const on = option.value === choice;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                saveThemeChoice(option.value);
                setChoice(option.value);
              }}
              className={`focus-ring min-h-11 rounded-[12px] text-sm transition-colors ${
                on ? "bg-brand-600 font-bold text-white" : "font-semibold text-ink-600 hover:bg-surface hover:text-ink-900"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-ink-500">기기 설정을 고르면 휴대폰이 어두운 모드일 때 같이 어두워져요. 이 기기에만 저장돼요.</p>
    </section>
  );
}
