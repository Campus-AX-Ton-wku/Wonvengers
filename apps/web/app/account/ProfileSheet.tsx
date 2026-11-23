"use client";

import { useId, useRef, useState } from "react";
import { BadgeMedal, Button, Icon3D, ProfileAvatar, Sheet } from "@/app/components";
import { badgeOf } from "@/lib/badges";
import { Camera, Check, ImageIcon } from "@/app/components/icons";
import { photoSrc } from "@/lib/profile-photo";
import { PhotoCropper } from "./PhotoCropper";
import { PROFILE_COLORS, PROFILE_ICONS, normalizeProfileName } from "@/lib/profile-card";
import { MAX_PROFILE_NAME, type BadgeId, type ProfileCardData } from "@/lib/user-data";

/** [저장]이 넘기는 사진 바뀜 — 새 사진(JPEG base64) · 지움 · 그대로 */
export type PhotoChange = { kind: "set"; image: string } | { kind: "remove" } | null;

/**
 * 프로필 꾸미기 창 (내 프로필 설계 §4, 시안 Profile · sheet '프로필 꾸미기') — 이름 · 그림 6 · 색 6.
 * 11/23 사진: 그림 칸 맨 앞 [앨범에서] [사진 찍기] → 사진 맞추기 화면 → 사진이 동그라미를 채운다. 그림을 누르면 그림으로,
 * '사진 지우기'도 그림으로. 사진도 [저장]을 눌러야 바뀐다(계정 저장은 ProfileCardSection).
 * [저장]을 눌러야 바뀐다. 창을 닫으면(Esc · 바깥) 그대로. 대표 배지 줄은 ② 배지에서.
 * 고른 칸은 테두리 + 체크 — 색만으로 말하지 않는다. 그림 · 색은 네이티브 라디오라 키보드 화살표로 고른다.
 */
export function ProfileSheet({
  card,
  photo,
  defaultName,
  earnedBadges,
  onSave,
  onClose,
}: {
  card: ProfileCardData;
  /** 지금 계정 사진(JPEG base64) — 없으면 null */
  photo: string | null;
  /** 받은 배지 — 대표 배지로 고를 수 있는 것 */
  earnedBadges: readonly BadgeId[];
  /** 비우면 쓰는 이름 — 자리 글자로 보여 준다 */
  defaultName: string;
  onSave: (next: ProfileCardData, photo: PhotoChange) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(card.name ?? "");
  const [icon, setIcon] = useState(card.icon);
  const [color, setColor] = useState(card.color);
  const [pinned, setPinned] = useState<BadgeId | null>(
    card.pinnedBadge && earnedBadges.includes(card.pinnedBadge) ? card.pinnedBadge : null
  );
  const nameId = useId();
  const count = [...name].length;
  /** 고른 사진(아직 저장 전). null 이면 그림 */
  const [draftPhoto, setDraftPhoto] = useState<string | null>(photo);
  /** 맞추는 중인 파일 */
  const [picked, setPicked] = useState<File | null>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const lastSource = useRef<"album" | "camera">("album");

  function pick(source: "album" | "camera") {
    lastSource.current = source;
    (source === "album" ? albumRef : cameraRef).current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 사진을 다시 골라도 바뀜이 생기게
    if (file) setPicked(file);
  }
  const photoChange: PhotoChange =
    draftPhoto === photo ? null : draftPhoto ? { kind: "set", image: draftPhoto } : { kind: "remove" };

  return (
    <Sheet title="프로필 꾸미기" onClose={onClose}>
      {/* 앱은 고른 한 장만 받는다 — 사진첩 전체를 보지 않는다. [사진 찍기]는 카메라를 바로 연다 */}
      <input ref={albumRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="photo-album-input" />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} data-testid="photo-camera-input" />
      <div className="flex items-center gap-3.5">
        <ProfileAvatar card={{ ...card, icon, color }} size="md" photo={draftPhoto ? photoSrc(draftPhoto) : null} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
      </div>

      <fieldset className="mt-2 flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-sm font-bold text-ink-900">
          <span>
            프로필 그림 <span className="font-medium text-ink-500">— 내 사진도 돼요</span>
          </span>
          {draftPhoto && (
            <button
              type="button"
              onClick={() => setDraftPhoto(null)}
              className="focus-ring -my-1.5 min-h-8 shrink-0 rounded px-1.5 text-[13px] font-semibold text-ink-500 underline underline-offset-[3px]"
            >
              사진 지우기
            </button>
          )}
        </legend>
        {/* 4칸씩 두 줄 — 앨범 · 사진 찍기 + 그림 6 (시안) */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            aria-pressed={draftPhoto !== null}
            aria-label="앨범에서 사진 고르기"
            onClick={() => pick("album")}
            className="focus-ring relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-control border border-ink-200 bg-surface text-xs font-semibold text-ink-700 aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-800"
          >
            {draftPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- 고른 사진 미리보기(data:)
              <img src={photoSrc(draftPhoto)} alt="" className="size-10 rounded-[12px] object-cover" />
            ) : (
              <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[12px] bg-brand-100 text-brand-700">
                <ImageIcon size={22} strokeWidth={2} />
              </span>
            )}
            앨범에서
          </button>
          <button
            type="button"
            aria-label="사진 찍기"
            onClick={() => pick("camera")}
            className="focus-ring flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-control border border-ink-200 bg-surface text-xs font-semibold text-ink-700"
          >
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[12px] bg-brand-100 text-brand-700">
              <Camera size={22} strokeWidth={2} />
            </span>
            사진 찍기
          </button>
          {PROFILE_ICONS.map((option) => (
            <label
              key={option.id}
              className="focus-within:ring-brand-500 relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-ink-200 bg-surface text-xs font-semibold text-ink-700 focus-within:ring-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
            >
              <input
                type="radio"
                name="profile-icon"
                value={option.id}
                checked={draftPhoto === null && icon === option.id}
                onChange={() => {
                  setIcon(option.id);
                  setDraftPhoto(null); // 그림을 고르면 그림으로 — 사진은 [저장] 때 지운다
                }}
                className="sr-only"
              />
              <Icon3D name={option.icon} size={40} />
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

      <fieldset className="mt-2 flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink-900">
          대표 배지 <span className="font-normal text-ink-500">— 받은 것 중 하나를 그림 옆에 걸어요</span>
        </legend>
        {earnedBadges.length === 0 ? (
          <p className="text-xs text-ink-500">배지를 받으면 여기서 걸 수 있어요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[null, ...earnedBadges].map((id) => (
              <label
                key={id ?? "none"}
                className="focus-within:ring-brand-500 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-ink-200 bg-surface py-1 pl-1.5 pr-3.5 text-[13px] font-semibold text-ink-700 focus-within:ring-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
              >
                <input
                  type="radio"
                  name="profile-pin"
                  checked={pinned === id}
                  onChange={() => setPinned(id)}
                  className="sr-only"
                />
                {id ? <BadgeMedal id={id} size="pin" /> : <span aria-hidden="true" className="w-1.5" />}
                {id ? badgeOf(id).label : "없음"}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <Button
        size="screen"
        className="mt-3"
        onClick={() => onSave({ ...card, icon, color, name: normalizeProfileName(name), pinnedBadge: pinned }, photoChange)}
      >
        저장
      </Button>

      {picked && (
        <PhotoCropper
          file={picked}
          onCancel={() => setPicked(null)}
          onRepick={() => {
            setPicked(null);
            pick(lastSource.current);
          }}
          onDone={(image) => {
            setDraftPhoto(image);
            setPicked(null);
          }}
        />
      )}
    </Sheet>
  );
}
