"use client";

import { Check, ICON_MD } from "./icons";

/**
 * 세로로 쌓이는 선택 버튼. 가로 3분할보다 터치 타깃이 크다.
 *
 * 비선택 상태에 테두리를 두르지 않는다. 선택지 여섯에 전부 테두리가 있으면 아직
 * 아무것도 고르지 않았는데도 화면이 상자로 가득 찬다. 지면(옅은 파랑) 위의 흰 면
 * 만으로 눌리는 자리가 보이므로 선은 필요 없다. 색은 실제로 고른 것에만 쓴다.
 *
 * 테두리 대신 ring 을 쓰는 이유: 두 상태의 높이가 1px 도 어긋나면 안 된다.
 * 고를 때마다 줄이 밀리면 목록 전체가 덜컥거린다.
 *
 * 선택 표시는 색 + 체크 아이콘 둘 다다. 색만으로 상태를 말하지 않는다.
 * aria-pressed 가 스크린리더에 같은 사실을 전한다.
 */
export function ChoiceCard({
  active,
  onClick,
  children,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** 선택지 아래 한 줄 보조 설명. 없으면 그리지 않는다. */
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring flex w-full items-center justify-between gap-3 rounded-control px-4 py-4 text-left transition-colors ${
        active
          ? "bg-brand-50 text-brand-900 ring-2 ring-inset ring-brand-600"
          : "bg-surface text-ink-700 hover:bg-brand-50 hover:ring-2 hover:ring-inset hover:ring-brand-200"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold">{children}</span>
        {hint && (
          <span className={`mt-0.5 block text-xs ${active ? "text-brand-800" : "text-ink-500"}`}>
            {hint}
          </span>
        )}
      </span>

      {/* 자리는 항상 잡아 둔다. 체크가 나타날 때 글자가 밀리면 안 된다. */}
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
          active ? "bg-brand-600 text-white" : "bg-transparent text-transparent"
        }`}
      >
        {active && <Check size={ICON_MD - 4} strokeWidth={3} />}
      </span>
    </button>
  );
}
