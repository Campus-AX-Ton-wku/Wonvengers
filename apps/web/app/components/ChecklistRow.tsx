import { Icon3D } from "./Icon3D";
import { Check, ICON_SM } from "./icons";
import type { Icon3DName } from "@/lib/icons3d";

/**
 * 눌러서 확인하는 줄 — 신청 준비(자격 · 기간 · 서류)와 집 보러 갈 때 체크리스트(11/22)가 같이 쓴다.
 * 줄 전체가 label 이라 어디를 눌러도 체크된다. 높이 76 이상.
 */
export function ChecklistRow({
  checked,
  label,
  support,
  icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  support?: React.ReactNode;
  /**
   * 서류 줄에만 — 서류 종류 3D 그림 32px(시안 '3D 아이콘 설계' 4번). 자격 · 기간 확인 줄은 서류가 아니라 비워 둔다:
   * 그림 있는 줄이 '챙길 서류', 없는 줄이 '확인할 것'으로 저절로 나뉜다.
   */
  icon?: Icon3DName;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="focus-within:ring-brand-500 flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-200 bg-surface px-4 py-3.5 focus-within:ring-2 focus-within:ring-offset-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {icon && <Icon3D name={icon} size={32} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-[22px] text-ink-900">{label}</span>
        {support &&
          (typeof support === "string" ? (
            <span className="mt-0.5 block text-[11px] leading-4 text-ink-500">{support}</span>
          ) : (
            support
          ))}
      </span>
      {/* 확인한 줄에만 '확인함'(11/20) — 줄마다 "확인 전"을 붙이면 같은 말이 반복된다. 상태는 checkbox 가 말한다.
          checkbox 는 sr-only 라, 확인 안 한 줄에는 빈 동그라미를 두어 누를 수 있는 줄로 보이게 한다. */}
      {checked ? (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-[10px] bg-ok-50 px-2.5 py-1.5 text-xs font-medium text-ok-700"
          aria-hidden="true"
        >
          <Check size={ICON_SM - 2} strokeWidth={2.5} />
          확인함
        </span>
      ) : (
        <span data-check-mark="empty" className="size-6 shrink-0 rounded-full border-2 border-ink-300" aria-hidden="true" />
      )}
    </label>
  );
}
