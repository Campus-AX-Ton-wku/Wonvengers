"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PROFILE_PHOTO_DELETE_KEY, PROFILE_PHOTO_KEY } from "./storage";
import { deletePhotoRemote, getPhotoRemote, putPhotoRemote } from "./remote";
import { syncEnabled } from "./sync";
import { MAX_PHOTO_BYTES, PHOTO_SIZE, base64Bytes } from "./profile-photo-data";
import type { ProfileCardData } from "./user-data";

/**
 * 프로필 사진 (11/23 — 사진도 계정에, 시안 '내 정보' 설계 노트 '사진으로 꾸미기').
 *
 * 사진 한 장은 따로 저장한다(GET · PUT · DELETE /me/photo). 사용자 데이터 묶음에는 고른 때(photoAt)만 적는다.
 * 이 기기에는 사본 하나 { at, image, uploaded } 를 둔다 — 화면은 사본만 보고, 올리기 · 받기는 여기서 한다.
 *  - 고르고 [저장] → 사본(uploaded:false) + 카드 photoAt → 올린다. 못 올리면(꺼진 서버 · 오프라인) 다음에 다시
 *  - 다른 기기 → 카드 photoAt 이 사본과 다르면 받는다
 *  - 지우기 → 사본을 지우고 서버에서도 지운다. 못 지우면 표시를 남겨 다음에 다시
 * 로그인 + 이 기기의 저장 동의가 있어야 서버와 주고받는다(lib/sync.ts syncEnabled).
 */

export interface LocalPhoto {
  at: string;
  /** JPEG base64 (머리말 없이) */
  image: string;
  uploaded: boolean;
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: LocalPhoto | null } = { raw: null, value: null };

function emit() {
  for (const l of listeners) l();
}

export function loadLocalPhoto(): LocalPhoto | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PROFILE_PHOTO_KEY);
  } catch {
    return null;
  }
  if (raw === cache.raw) return cache.value;
  let value: LocalPhoto | null = null;
  try {
    const o = raw ? (JSON.parse(raw) as Partial<LocalPhoto>) : null;
    if (o && typeof o.at === "string" && typeof o.image === "string" && typeof o.uploaded === "boolean") {
      value = { at: o.at, image: o.image, uploaded: o.uploaded };
    }
  } catch {
    value = null;
  }
  cache = { raw, value };
  return value;
}

function writeLocalPhoto(photo: LocalPhoto | null): void {
  try {
    if (photo) window.localStorage.setItem(PROFILE_PHOTO_KEY, JSON.stringify(photo));
    else window.localStorage.removeItem(PROFILE_PHOTO_KEY);
  } catch {
    // 저장이 막혀 있으면(사생활 보호 모드) 이번 화면에서만 못 본다 — 계정에는 올라간다
  }
  emit();
}

function setDeletePending(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(PROFILE_PHOTO_DELETE_KEY, "1");
    else window.localStorage.removeItem(PROFILE_PHOTO_DELETE_KEY);
  } catch {
    // 표시를 못 남기면 서버 사진이 남는다 — 다음에 고르면 덮어쓰고, 탈퇴 때 지워진다
  }
}

function deletePending(): boolean {
  try {
    return window.localStorage.getItem(PROFILE_PHOTO_DELETE_KEY) === "1";
  } catch {
    return false;
  }
}

export function photoSrc(image: string): string {
  return `data:image/jpeg;base64,${image}`;
}

/** [저장]으로 새 사진을 정했다 — 사본에 두고 올린다. 카드에 적을 photoAt 을 돌려준다. */
export function choosePhoto(image: string, now = new Date()): string {
  const at = now.toISOString();
  setDeletePending(false);
  writeLocalPhoto({ at, image, uploaded: false });
  return at;
}

/** [저장]으로 사진을 지웠다 — 사본을 지우고 서버에서도 지운다. */
export function removePhoto(): void {
  setDeletePending(true);
  writeLocalPhoto(null);
}

let running: Promise<void> | null = null;

/**
 * 서버와 맞춘다 — 못 지운 것 지우기, 못 올린 것 올리기, 카드가 가리키는 사진이 없으면 받기.
 * 실패는 조용히 넘긴다(다음 화면에서 다시). 동시에 두 번 돌지 않는다.
 */
export function syncPhoto(card: ProfileCardData | null): Promise<void> {
  if (typeof window === "undefined" || !syncEnabled()) return Promise.resolve();
  running ??= (async () => {
    try {
      if (deletePending()) {
        await deletePhotoRemote();
        setDeletePending(false);
      }
      const local = loadLocalPhoto();
      if (local && !local.uploaded) {
        await putPhotoRemote({ image: local.image, at: local.at });
        if (loadLocalPhoto()?.at === local.at) writeLocalPhoto({ ...local, uploaded: true });
      }
      const want = card?.photoAt;
      if (want && loadLocalPhoto()?.at !== want) {
        const remote = await getPhotoRemote();
        // 서버 사진이 카드가 가리키는 것과 같을 때만 — 다른 기기가 아직 올리는 중이면 다음에 다시
        if (remote && remote.at === want) writeLocalPhoto({ ...remote, uploaded: true });
      }
    } catch {
      // 다음에 다시
    } finally {
      running = null;
    }
  })();
  return running;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_PHOTO_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * 카드가 가리키는 사진의 data URL — 없거나 아직 못 받았으면 null(그림을 보인다).
 * 처음 그릴 때 서버와 한 번 맞춘다.
 */
export function useProfilePhoto(card: ProfileCardData | null): string | null {
  const image = useProfilePhotoImage(card);
  return image ? photoSrc(image) : null;
}

/** useProfilePhoto 의 base64 그대로 — 꾸미기 창이 '지금 사진'으로 넘겨받는다 */
export function useProfilePhotoImage(card: ProfileCardData | null): string | null {
  const local = useSyncExternalStore(subscribe, loadLocalPhoto, () => null);
  const photoAt = card?.photoAt;
  useEffect(() => {
    void syncPhoto(card);
    // photoAt 이 바뀔 때만 — 이름 · 색을 바꿀 때마다 서버에 묻지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoAt]);
  return photoAt && local?.at === photoAt ? local.image : null;
}

// ── 고른 사진 맞추기 (동그라미) ──

export interface CropView {
  /** 화면의 동그라미 지름(px) */
  circle: number;
  /** 원본 크기(px) */
  width: number;
  height: number;
  /** 1 = 짧은 변이 동그라미를 딱 덮는 크기. 막대 · 두 손가락으로 1~MAX_ZOOM */
  zoom: number;
  /** 사진 가운데가 동그라미 가운데에서 떨어진 거리(화면 px) */
  x: number;
  y: number;
}

export const MAX_ZOOM = 4;

/** 화면 px 당 원본 px 의 역수 — 화면에서 사진을 그리는 배율 */
export function cropScale(v: Pick<CropView, "circle" | "width" | "height" | "zoom">): number {
  return (v.circle / Math.min(v.width, v.height)) * v.zoom;
}

/** 동그라미 밖으로 빈 곳이 보이지 않게 옮김 · 배율을 묶는다 */
export function clampCrop(v: CropView): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const scale = cropScale({ ...v, zoom });
  const maxX = Math.max(0, (v.width * scale - v.circle) / 2);
  const maxY = Math.max(0, (v.height * scale - v.circle) / 2);
  // `|| 0` — 움직일 여유가 없을 때 -0 이 남지 않게
  return { ...v, zoom, x: Math.min(maxX, Math.max(-maxX, v.x)) || 0, y: Math.min(maxY, Math.max(-maxY, v.y)) || 0 };
}

/** 동그라미가 덮는 원본의 정사각형 { sx, sy, size } (원본 px) */
export function cropSource(v: CropView): { sx: number; sy: number; size: number } {
  const c = clampCrop(v);
  const scale = cropScale(c);
  const size = c.circle / scale;
  const cx = c.width / 2 - c.x / scale;
  const cy = c.height / 2 - c.y / scale;
  return { sx: cx - size / 2, sy: cy - size / 2, size };
}

/**
 * 동그라미 부분만 256×256 JPEG 로 다시 그린다 — 40KB 를 넘으면 화질을 낮춰 다시. base64(머리말 없이).
 * 캔버스로 다시 그리므로 촬영 위치 같은 숨은 정보(EXIF)는 남지 않는다.
 */
export function encodeCrop(img: CanvasImageSource, v: CropView): string | null {
  const { sx, sy, size } = cropSource(v);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  for (const quality of [0.86, 0.78, 0.7, 0.6, 0.5, 0.4]) {
    const image = canvas.toDataURL("image/jpeg", quality).replace(/^data:image\/jpeg;base64,/, "");
    if (image.startsWith("/9j/") && base64Bytes(image) <= MAX_PHOTO_BYTES) return image;
  }
  return null;
}
