"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ICON_MD, ImageIcon, X } from "@/app/components/icons";
import { MAX_ZOOM, clampCrop, cropScale, encodeCrop, type CropView } from "@/lib/profile-photo";

/**
 * 사진 맞추기 화면 (11/23 시안 '내 정보' · sheet '사진 맞추기').
 * 검은 화면에 동그라미 틀. 끌어서 옮기고, 두 손가락으로 키운다 — 한 손으로도 쓸 수 있게 아래 막대로도 크기를 바꾼다.
 * [완료]는 동그라미 부분만 256×256 JPEG 로 다시 그려 돌려준다(lib/profile-photo.ts encodeCrop). 계정 저장은
 * 꾸미기 창의 [저장]을 눌러야 일어난다.
 */
export function PhotoCropper({
  file,
  onDone,
  onRepick,
  onCancel,
}: {
  file: File;
  onDone: (image: string) => void;
  /** [다시 고르기] — 앨범을 다시 연다 */
  onRepick: () => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [circle, setCircle] = useState(280);
  const [view, setView] = useState<Omit<CropView, "circle" | "width" | "height">>({ zoom: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const sliderId = useId();
  const titleId = useId();

  // 고른 파일을 읽는다. blob: 주소는 화면을 닫을 때 돌려준다
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setFailed(true);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 동그라미 지름 — 시안 300px(390 화면). 좁은 화면은 양옆 45px 를 남긴다
  useEffect(() => {
    const fit = () => setCircle(Math.min(300, window.innerWidth - 90));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Esc 로 닫는다. 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel]);

  const full: CropView | null = img ? clampCrop({ circle, width: img.naturalWidth, height: img.naturalHeight, ...view }) : null;
  const scale = full ? cropScale(full) : 1;

  function update(next: Partial<Omit<CropView, "circle" | "width" | "height">>) {
    if (!img) return;
    setView((prev) => {
      const c = clampCrop({ circle, width: img.naturalWidth, height: img.naturalHeight, ...prev, ...next });
      return { zoom: c.zoom, x: c.x, y: c.y };
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: full?.zoom ?? 1 };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) update({ zoom: (pinch.current.zoom * dist) / pinch.current.dist });
      return;
    }
    update({ x: (full?.x ?? 0) + (e.clientX - prev.x), y: (full?.y ?? 0) + (e.clientY - prev.y) });
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function done() {
    if (!img || !full) return;
    const image = encodeCrop(img, full);
    if (image) onDone(image);
    else setFailed(true);
  }

  const zoomPercent = full ? ((full.zoom - 1) / (MAX_ZOOM - 1)) * 100 : 0;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[70] overflow-hidden bg-[#05070b] text-white">
      <div className="absolute inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-10 flex h-14 items-center justify-center">
        <button
          type="button"
          aria-label="취소"
          onClick={onCancel}
          className="focus-ring absolute left-2 flex size-11 items-center justify-center rounded-[14px]"
        >
          <X size={ICON_MD + 2} aria-hidden="true" />
        </button>
        <h2 id={titleId} className="text-[17px] font-bold">
          사진 맞추기
        </h2>
      </div>

      {/* 사진 + 동그라미 틀 — 아래 조작 칸을 뺀 자리의 가운데(시안: 동그라미 위 245 / 844). 사진은 조작 칸 밑으로도 비친다 */}
      <div
        className="absolute inset-x-0 top-0 touch-none select-none"
        style={{ height: "calc(100% - 140px)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {img && full && (
          // eslint-disable-next-line @next/next/no-img-element -- 고른 사진(blob:)을 그대로 옮기며 보여 준다
          <img
            src={img.src}
            alt="고른 사진"
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              transform: `translate(calc(-50% + ${full.x}px), calc(-50% + ${full.y}px))`,
            }}
          />
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: circle, height: circle, boxShadow: "0 0 0 2px rgba(255,255,255,0.92), 0 0 0 999px rgba(5,7,11,0.62)" }}
        />
        {failed && (
          <p role="alert" className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm">
            이 사진은 쓸 수 없어요. 다른 사진을 골라 주세요.
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-5 pb-[max(env(safe-area-inset-bottom),16px)]">
        <p className="text-center text-sm leading-normal text-white/[0.78]">끌어서 옮기고, 두 손가락으로 키워요</p>
        <div className="mx-3 flex h-11 items-center gap-3">
          <label htmlFor={sliderId} className="sr-only">
            크기
          </label>
          <span aria-hidden="true" className="text-white/70">
            <ImageIcon size={16} strokeWidth={2} />
          </span>
          <input
            id={sliderId}
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={full?.zoom ?? 1}
            disabled={!img}
            onChange={(e) => update({ zoom: Number(e.target.value) })}
            className="crop-range h-11 flex-1"
            style={{ "--fill": `${zoomPercent}%` } as React.CSSProperties}
          />
          <span aria-hidden="true" className="text-white/70">
            <ImageIcon size={24} strokeWidth={2} />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRepick}
            className="focus-ring min-h-[52px] rounded-[16px] bg-white/[0.14] text-base font-bold"
          >
            다시 고르기
          </button>
          <button
            type="button"
            onClick={done}
            disabled={!img || failed}
            className="focus-ring min-h-[52px] rounded-[16px] bg-brand-600 text-base font-bold disabled:opacity-50"
          >
            완료
          </button>
        </div>
        <p className="text-center text-xs leading-normal text-white/55">
          작게 줄여 저장하고, 사진 속 위치 정보는 지워요
        </p>
      </div>
    </div>,
    document.body
  );
}

