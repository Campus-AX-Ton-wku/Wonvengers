"use client";

import { useState, type CSSProperties } from "react";
import { Button, LinkButton, ProfileAvatar } from "@/app/components";
import { resolveAnswers } from "@/lib/age";
import { answerLine } from "@/lib/discovery";
import { DEFAULT_PROFILE_CARD, profileColor, profileName } from "@/lib/profile-card";
import { saveProfileCard } from "@/lib/storage";
import type { DiscoveryAnswers } from "@/lib/types";
import type { ProfileCardData } from "@/lib/user-data";
import { ProfileSheet } from "./ProfileSheet";

/**
 * 내 정보 맨 위 프로필 카드 (내 프로필 설계 §3, 시안 Profile) — 위쪽이 고른 색으로 물든 카드.
 * 그림 동그라미 · 이름(기본 이름이면 안내 한 줄) · 내 조건 칩(나이 · 지역 · 상태 · 집 형태) · [프로필 꾸미기] [내 조건 수정].
 * 금액은 보여 주지 않는다. 이름 · 그림 · 색은 계정에 저장된다(lib/storage.ts saveProfileCard → 동기화).
 */
export function ProfileCardSection({
  card,
  answers,
  today,
  onSaved,
}: {
  card: ProfileCardData | null;
  answers: DiscoveryAnswers;
  today: string;
  onSaved: (next: ProfileCardData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const shown = card ?? DEFAULT_PROFILE_CARD;
  const { name, isDefault } = profileName(card, answers);
  const color = profileColor(shown.color);
  const hasAnswers = Object.values(answers).some((v) => v !== null);
  const chips = hasAnswers
    ? [...answerLine(resolveAnswers(answers, today)).split(" · "), ...(answers.housingType ? [answers.housingType] : [])]
    : [];

  return (
    <section
      aria-label="내 프로필"
      data-profile-color={shown.color}
      style={{ "--tint": color.tint, "--tint-dark": color.darkTint } as CSSProperties}
      className="flex flex-col items-center gap-4 rounded-[24px] bg-[linear-gradient(180deg,var(--tint)_0%,var(--tint)_46%,var(--color-surface)_100%)] px-5 pb-5 pt-6 text-center shadow-card dark:bg-[linear-gradient(180deg,var(--tint-dark)_0%,var(--tint-dark)_46%,var(--color-surface)_100%)]"
    >
      <ProfileAvatar card={shown} size="lg" />
      <div className="flex flex-col gap-1">
        <h2 className="text-balance text-[22px] font-extrabold leading-snug text-ink-900">{name}</h2>
        {isDefault && <p className="text-xs text-ink-500">내 조건으로 지은 이름이에요 · 바꿀 수 있어요</p>}
      </div>
      {chips.length > 0 && (
        <ul aria-label="내 조건" className="flex flex-wrap justify-center gap-1.5">
          {chips.map((chip) => (
            <li key={chip} className="rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink-700 shadow-[inset_0_0_0_1px_var(--color-ink-200)]">
              {chip}
            </li>
          ))}
        </ul>
      )}
      <div className="grid w-full grid-cols-2 gap-2">
        <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
          프로필 꾸미기
        </Button>
        <LinkButton href="/find" variant="quiet" size="md">
          내 조건 수정
        </LinkButton>
      </div>

      {editing && (
        <ProfileSheet
          card={shown}
          defaultName={profileName(null, answers).name}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            saveProfileCard(next);
            onSaved(next);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}
