"use client";

import { useEffect, useRef, useState } from "react";
import { MONTH_OPTIONS, dayOptions, fromISODate, toISODate } from "@/lib/date";
import {
  ITEM_HEIGHT,
  WHEEL_HEIGHT,
  WHEEL_PAD,
  clampIndex,
  indexFromScroll,
  scrollTopForIndex,
} from "@/lib/wheel";

/**
 * 스크롤형 휠 데이트 피커 (Wheel Date Picker). 실기기 확인을 거쳐 채택했다 (2026-08-27).
 *
 * 남은 것: 타이핑 점프. 네이티브 select 는 '9' 를 누르면 9월로 뛰는데 여기는 없다.
 * 목록이 최대 31개라 화살표로도 닿긴 하지만, 키보드 사용자에게는 select 보다 느리다.
 *
 * ── 왜 이렇게 만들었나 ──────────────────────────────────────────────
 *
 * 세로 스크롤 + CSS scroll-snap 이면 관성 스크롤과 스냅을 브라우저가 해준다.
 * JS 로 위치를 애니메이션하지 않으므로 손맛이 네이티브와 같고, 새 의존성이 없다.
 *
 * 빈 값을 지킨다. 휠은 항상 무언가를 가리키고 있어서, 인라인으로 늘 띄워두면
 * 손대지 않은 사람도 '오늘 날짜'를 제출하게 된다. 그래서 트리거 버튼을 두고,
 * 패널 안에서 굴린 값은 초안(draft)으로만 갖고 있다가 '확인' 을 눌러야 올려보낸다.
 * 그때까지 값은 "" 이고, 각 화면의 필수값 검증이 그걸 잡는다.
 */

type Parts = { year: number; month: number; day: number };

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

/** 아직 아무것도 안 고른 상태에서 휠을 어디에 놓고 시작할지. */
function startingParts(years: number[]): Parts {
  const now = new Date();
  const year = years.includes(now.getFullYear()) ? now.getFullYear() : years[0];
  return { year, month: now.getMonth() + 1, day: now.getDate() };
}

/** 스크롤로 고르는 한 컬럼. */
function Column({
  ariaLabel,
  values,
  selected,
  suffix,
  onSelect,
}: {
  ariaLabel: string;
  values: number[];
  selected: number;
  suffix: string;
  onSelect: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* 사용자가 굴리는 중에 programmatic scroll 을 걸면 손가락과 싸운다.
     스크롤이 멎은 뒤에만 외부 값으로 위치를 맞춘다. */
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, values.indexOf(selected));

  useEffect(() => {
    const el = ref.current;
    if (!el || settling.current) return;
    const top = scrollTopForIndex(index);
    // 1px 이내는 스냅 오차다. 다시 쓰면 스크롤이 튄다.
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
  }, [index]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => (settling.current = null), 140);

    const next = values[indexFromScroll(el.scrollTop, values.length)];
    if (next !== undefined && next !== selected) onSelect(next);
  }

  /* 키보드 — 네이티브 select 가 공짜로 주던 것을 직접 짠다.
     타이핑 점프(예: '9' 를 눌러 9월로)는 아직 없다. */
  function handleKeyDown(e: React.KeyboardEvent) {
    const move = (delta: number) => {
      e.preventDefault();
      onSelect(values[clampIndex(index + delta, values.length)]);
    };
    if (e.key === "ArrowDown") return move(1);
    if (e.key === "ArrowUp") return move(-1);
    if (e.key === "PageDown") return move(3);
    if (e.key === "PageUp") return move(-3);
    if (e.key === "Home") return move(-index);
    if (e.key === "End") return move(values.length - 1 - index);
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${ariaLabel}-${selected}`}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      className={`no-scrollbar flex-1 snap-y snap-mandatory overflow-y-scroll rounded-lg ${FOCUS_RING}`}
      style={{ height: WHEEL_HEIGHT, paddingTop: WHEEL_PAD, paddingBottom: WHEEL_PAD }}
    >
      {values.map((v) => (
        <div
          key={v}
          id={`${ariaLabel}-${v}`}
          role="option"
          aria-selected={v === selected}
          onClick={() => onSelect(v)}
          className={`flex snap-center items-center justify-center text-base tabular-nums transition-colors ${
            v === selected ? "font-bold text-ink-900" : "text-ink-500"
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          {v}
          {suffix}
        </div>
      ))}
    </div>
  );
}

export default function WheelDatePicker({
  id,
  label,
  years,
  value,
  onChange,
}: {
  /** 트리거 버튼의 id. 바깥 <label htmlFor> 과 묶을 때 쓴다. */
  id?: string;
  label: string;
  years: number[];
  /** YYYY-MM-DD, 아직 안 고르면 "" */
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Parts>(() => fromISODate(value) ?? startingParts(years));

  // 저장된 값은 마운트 뒤에 들어온다(localStorage). 그때 초안도 그 자리로 맞춘다.
  useEffect(() => {
    const saved = fromISODate(value);
    if (saved) setDraft(saved);
  }, [value]);

  function patch(next: Partial<Parts>) {
    setDraft((prev) => {
      const merged = { ...prev, ...next };
      // 3월 31일에서 2월로 옮기면 2월 31일이 남는다. 그 달의 마지막 날로 자른다.
      merged.day = Math.min(merged.day, dayOptions(merged.year, merged.month).length);
      return merged;
    });
  }

  const shown = fromISODate(value);
  const shownText = shown ? `${shown.year}년 ${shown.month}월 ${shown.day}일` : null;

  return (
    <div className="flex flex-col gap-2">
      {/* 버튼이 스스로 필드명과 현재 값을 말한다. 바깥 <label> 이 이름을 덮으면
          스크린리더가 "생년월일, 버튼" 까지만 읽고 고른 날짜를 알려주지 않는다. */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${label} — ${shownText ?? "선택 안 함"}`}
        className={`input flex items-center justify-between text-left ${
          shown ? "font-semibold text-ink-900" : "text-ink-500"
        } ${FOCUS_RING}`}
      >
        <span>{shownText ?? "날짜 선택"}</span>
        <span aria-hidden="true" className="text-xs text-ink-500">
          {open ? "닫기" : "고르기"}
        </span>
      </button>

      {open && (
        <div className="rounded-xl border border-ink-200 bg-white p-2">
          {/* 가운데 한 줄이 선택 위치다. 밴드는 장식이므로 터치를 먹지 않는다. */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-10 rounded-lg bg-brand-50"
              style={{ top: WHEEL_PAD, height: ITEM_HEIGHT }}
            />
            <div className="relative z-20 flex gap-1">
              <Column
                ariaLabel={`${label} 년`}
                values={years}
                selected={draft.year}
                suffix="년"
                onSelect={(year) => patch({ year })}
              />
              <Column
                ariaLabel={`${label} 월`}
                values={MONTH_OPTIONS}
                selected={draft.month}
                suffix="월"
                onSelect={(month) => patch({ month })}
              />
              <Column
                ariaLabel={`${label} 일`}
                values={dayOptions(draft.year, draft.month)}
                selected={draft.day}
                suffix="일"
                onSelect={(day) => patch({ day })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(toISODate(draft.year, draft.month, draft.day));
              setOpen(false);
            }}
            className={`mt-2 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 ${FOCUS_RING}`}
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
