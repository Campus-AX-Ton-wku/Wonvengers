import { Check, Circle, ICON_SM } from "@/app/components/icons";

/**
 * [냈어요] · [받았어요] — 한 번 누르면 기록, 다시 누르면 취소 (시안 '주거비 달력 · 달력 탭').
 * 빈 동그라미 ↔ 체크 + 파랑 채움으로 바뀐다 — 색만으로 말하지 않는다. 상태는 aria-pressed.
 */
export function CheckButton({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  /** 읽는 이름 — "월세 냈어요" */
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`focus-ring inline-flex h-11 min-w-24 shrink-0 items-center justify-center gap-1 rounded-[14px] px-3 text-sm font-bold transition-colors ${
        pressed
          ? "bg-brand-600 text-white shadow-[inset_0_-2px_0_rgba(10,58,128,0.35)] hover:bg-brand-700"
          : "bg-surface text-brand-700 shadow-[inset_0_0_0_1.5px_var(--color-brand-200)] hover:bg-brand-50"
      }`}
    >
      {pressed ? (
        <Check size={ICON_SM} strokeWidth={2.6} aria-hidden="true" className="shrink-0" />
      ) : (
        <Circle size={ICON_SM} strokeWidth={2} aria-hidden="true" className="shrink-0 text-brand-300" />
      )}
      {children}
    </button>
  );
}
