"use client";

import { useId, useState } from "react";
import { Button, Icon3D, Sheet } from "@/app/components";
import { Check } from "@/app/components/icons";
import { PROFILE_COLORS, PROFILE_ICONS, normalizeProfileName } from "@/lib/profile-card";
import { MAX_PROFILE_NAME, type ProfileCardData } from "@/lib/user-data";

/**
 * 프로필 꾸미기 창 (내 프로필 설계 §4, 시안 Profile · sheet '프로필 꾸미기') — 이름 · 그림 6 · 색 6.
 * [저장]을 눌러야 바뀐다. 창을 닫으면(Esc · 바깥) 그대로. 대표 배지 줄은 ② 배지에서.
 * 고른 칸은 테두리 + 체크 — 색만으로 말하지 않는다. 그림 · 색은 네이티브 라디오라 키보드 화살표로 고른다.
 */
export function ProfileSheet({
  card,
  defaultName,
  onSave,
  onClose,
}: {
  card: ProfileCardData;
  /** 비우면 쓰는 이름 — 자리 글자로 보여 준다 */
  defaultName: string;
  onSave: (next: ProfileCardData) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(card.name ?? "");
  const [icon, setIcon] = useState(card.icon);
  const [color, setColor] = useState(card.color);
  const nameId = useId();
  const count = [...name].length;

  return (
    <Sheet title="프로필 꾸미기" onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={nameId} className="text-sm font-bold text-ink-900">
            이름
          </label>
          <span className="text-xs text-ink-500" aria-hidden="true">
            {count}/{MAX_PROFILE_NAME}
          </span>
        </div>
        <input
          id={nameId}
          type="text"
          value={name}
          placeholder={defaultName}
          autoComplete="off"
          enterKeyHint="done"
          // 글자 단위로 10자 — maxLength 는 이모지를 2로 세서 직접 자른다
          onChange={(e) => setName([...e.target.value].slice(0, MAX_PROFILE_NAME).join(""))}
          className="input focus-ring min-h-12 w-full rounded-control border border-ink-200 bg-surface px-4 text-base text-ink-900 placeholder:text-ink-500"
        />
        <p className="text-xs text-ink-500">비우면 내 조건으로 지은 이름을 써요.</p>
      </div>

      <fieldset className="mt-2 flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink-900">그림</legend>
        <div className="grid grid-cols-3 gap-2">
          {PROFILE_ICONS.map((option) => (
            <label
              key={option.id}
              className="focus-within:ring-brand-500 relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-ink-200 bg-surface text-xs font-semibold text-ink-700 focus-within:ring-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
            >
              <input
                type="radio"
                name="profile-icon"
                value={option.id}
                checked={icon === option.id}
                onChange={() => setIcon(option.id)}
                className="sr-only"
              />
              <Icon3D name={option.icon} size={36} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-2 flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink-900">색</legend>
        {/* 한 줄 6칸(390px 이상) · 좁으면 3칸씩 두 줄 — 4 + 2 로 어정쩡하게 꺾이지 않게. 칸은 44px 그대로 */}
        <div className="grid w-fit grid-cols-3 gap-2.5 min-[380px]:grid-cols-6 min-[380px]:gap-1.5">
          {PROFILE_COLORS.map((option) => (
            <label
              key={option.id}
              title={option.label}
              style={{ "--swatch": option.strong, "--swatch-dark": option.darkStrong } as React.CSSProperties}
              className="focus-within:ring-brand-500 relative flex size-11 cursor-pointer items-center justify-center rounded-full bg-[var(--swatch)] shadow-[inset_0_0_0_1px_rgba(11,42,74,0.08)] focus-within:ring-2 focus-within:ring-offset-2 has-[:checked]:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-brand-600)] dark:bg-[var(--swatch-dark)]"
            >
              <input
                type="radio"
                name="profile-color"
                value={option.id}
                aria-label={option.label}
                checked={color === option.id}
                onChange={() => setColor(option.id)}
                className="sr-only"
              />
              {color === option.id && <Check size={18} strokeWidth={2.75} aria-hidden="true" className="text-ink-900" />}
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        size="screen"
        className="mt-3"
        onClick={() => onSave({ ...card, icon, color, name: normalizeProfileName(name) })}
      >
        저장
      </Button>
    </Sheet>
  );
}
