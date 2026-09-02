"use client";

import { CircleAlert, ICON_SM } from "./icons";
import { formatKoreanMoney, manwonToWon, wonToManwon } from "@/lib/money";

/**
 * 입력 칸의 라벨·오류·보조 텍스트를 한 규격으로 묶는다.
 *
 * 칸 자체의 모양(테두리·포커스 링·높이·16px 글씨)은 globals.css 의 `.input` 이
 * 단독으로 갖는다. 여기서 다시 정의하지 않는다.
 */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-ink-700">{label}</span>
      {children}
      {hint}
    </label>
  );
}

/**
 * 라벨이 붙은 버튼 그룹.
 *
 * Field(<label>)로 감싸면 안 된다 — button 은 labelable 요소라서 첫 버튼이
 * label 전체 텍스트를 자기 접근성 이름으로 가져간다("계약 형태 월세 연세, 버튼").
 */
export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-bold text-ink-700">{label}</span>
      {children}
    </div>
  );
}

/**
 * 입력 오류. 색만으로 말하지 않도록 아이콘을 함께 둔다.
 * role="alert" 라 스크린리더가 나타나는 즉시 읽는다.
 */
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-control bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700"
    >
      <CircleAlert size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * 금액 입력. 만원 단위로 주고받고, 아래에 사람이 읽는 형태를 붙인다 (PRD F1-8).
 * '다음'을 누를 때까지 기다리면 0 을 하나 더/덜 친 실수를 늦게 알게 된다.
 *
 * 값은 원 단위로 오간다 — 계산·저장 쪽은 이 컴포넌트를 몰라도 된다.
 * null 은 '비어 있음'이다. 0 을 값으로 보여주면 사용자가 지우고 입력해야 한다.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  /** 원 단위. 비었으면 null. */
  value: number | null;
  onChange: (won: number | null) => void;
  /**
   * 빈 칸이 무엇을 뜻하는지에 따라 준다.
   *   계약 조건 입력 — "0" (0원을 뜻한다)
   *   판정 질문     — 없음 (빈 칸은 '모름'이다. "0" 을 띄우면 소득 0원으로 읽힌다)
   */
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        className="input"
        value={value === null ? "" : (wonToManwon(value) ?? "")}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : manwonToWon(Math.max(0, Number(e.target.value) || 0)))
        }
        min={0}
        placeholder={placeholder}
      />
      {value !== null && value > 0 && (
        <p aria-hidden="true" className="text-xs font-bold text-accent-700">
          {formatKoreanMoney(value)}
        </p>
      )}
    </div>
  );
}

/** 금액이 아닌 숫자(개월 수·가구원 수). 만원 환산도 읽어주기도 없다. */
export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** MoneyInput 의 placeholder 주석과 같은 이유로 기본값을 두지 않는다. */
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      className="input"
      value={value === null ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
      min={0}
      placeholder={placeholder}
    />
  );
}
