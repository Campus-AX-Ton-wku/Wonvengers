"use client";

import { useEffect, useRef, useState } from "react";
import { MONTH_OPTIONS, dayOptions, fromISODate, toISODate } from "@/lib/date";
import {
  ITEM_HEIGHT,
  TYPE_AHEAD_MS,
  WHEEL_HEIGHT,
  WHEEL_PAD,
  clampIndex,
  indexFromScroll,
  scrollTopForIndex,
  typeAheadMatch,
} from "@/lib/wheel";

/**
 * 스크롤형 휠 데이트 피커 (Wheel Date Picker). 실기기 확인을 거쳐 채택했다 (2026-08-27).
 *
 * 키보드는 네이티브 select 가 주던 것을 직접 짠다 — 화살표·PageUp/Down·Home/End 와
 * 숫자 타이핑 점프('9' 를 누르면 9월로). 생년 목록은 28개라 화살표만으로는 멀다.
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

/* globals.css 의 prefers-reduced-motion 규칙은 CSS 애니메이션만 끈다.
   scrollTo({behavior:"smooth"}) 는 별개라 여기서 직접 물어본다. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

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
  /* 타이핑 점프용 버퍼. "3" 다음 "1" 이 1초 안에 오면 31 로 좁힌다. */
  const buffer = useRef("");
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, values.indexOf(selected));

  useEffect(() => {
    const el = ref.current;
    if (!el || settling.current) return;
    const top = scrollTopForIndex(index);
    // 1px 이내는 스냅 오차다. 다시 쓰면 스크롤이 튄다.
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
  }, [index]);

  useEffect(() => {
    // 패널을 닫으면 컬럼이 언마운트된다. 남은 타이머가 사라진 ref 를 건드리지 않게 정리한다.
    return () => {
      if (settling.current) clearTimeout(settling.current);
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
    };
  }, []);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (settling.current) clearTimeout(settling.current);
    /* 마지막 스크롤 이벤트로부터 140ms 뒤 = 관성이 멎은 시점. 관성 중에는 계속
       리셋되므로 이 타이머는 손을 뗀 뒤 한 번만 터진다. */
    settling.current = setTimeout(() => {
      settling.current = null;
      alignToNearest();
    }, 140);

    const next = values[indexFromScroll(el.scrollTop, values.length)];
    if (next !== undefined && next !== selected) onSelect(next);
  }

  /**
   * snap-proximity 는 스냅을 **보장하지 않는다.** 그게 목적이다 — mandatory 는
   * 가장 가까운 지점으로 강제로 붙잡아 긴 플릭을 중간에 죽인다. 28개짜리 생년
   * 목록에서 그게 답답함의 정체였다.
   *
   * 대신 관성이 멎은 자리가 항목 사이에 걸칠 수 있다. 그러면 가운데 하이라이트
   * 밴드와 고른 값이 어긋나 보인다. 그래서 멎은 뒤 정확히 가운데로 붙인다.
   */
  function alignToNearest() {
    const el = ref.current;
    if (!el) return;
    const top = scrollTopForIndex(indexFromScroll(el.scrollTop, values.length));
    if (Math.abs(el.scrollTop - top) <= 1) return; // 이미 맞았다. 다시 쓰면 튄다.
    el.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  /* 키보드 — 네이티브 select 가 공짜로 주던 것을 직접 짠다. */
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

    /* 숫자 타이핑 점프. 이어 치면 "1"→1월, "12"→12월 로 좁혀진다.
       이어 붙인 버퍼로 못 찾으면 방금 누른 글자만으로 다시 찾는다 — select 와 같다.
       (생년 2003 을 치다가 오타가 나도 마지막 숫자부터 다시 시작한다.) */
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const joined = buffer.current + e.key;
      const joinedHit = typeAheadMatch(values, joined);
      buffer.current = joinedHit !== null ? joined : e.key;

      if (bufferTimer.current) clearTimeout(bufferTimer.current);
      bufferTimer.current = setTimeout(() => (buffer.current = ""), TYPE_AHEAD_MS);

      const hit = joinedHit ?? typeAheadMatch(values, e.key);
      if (hit !== null) onSelect(hit);
      return;
    }

    // 숫자가 아닌 키가 오면 치던 숫자열은 버린다.
    buffer.current = "";
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
      className={`no-scrollbar flex-1 snap-y snap-proximity overflow-y-scroll rounded-lg ${FOCUS_RING}`}
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
  defaultOpen = false,
}: {
  /** 트리거 버튼의 id. 바깥 <label htmlFor> 과 묶을 때 쓴다. */
  id?: string;
  label: string;
  years: number[];
  /** YYYY-MM-DD, 아직 안 고르면 "" */
  value: string;
  onChange: (value: string) => void;
  /**
   * 마운트할 때 패널을 펼친 채로 시작한다.
   *
   * 한 화면에 이 질문 하나뿐인 자리(1층 첫 단계)에서 쓴다. 닫힌 채로 두면 화면
   * 절반이 비고 사용자가 할 일이 '고르기'를 한 번 누르는 것뿐이다 — 토스가 같은
   * 자리에서 키보드를 올려 두는 것과 같은 이유다.
   */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
