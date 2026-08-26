"use client";

import { useEffect, useState } from "react";
import { MONTH_OPTIONS, dayOptions, fromISODate, toISODate } from "@/lib/date";

/**
 * 날짜를 년/월/일 목록에서 고른다.
 *
 * <input type="date"> 를 쓰지 않는 이유: 기기마다 생김새가 다르고, 모바일에서
 * 오늘 날짜에서 시작해 원하는 해까지 굴려야 한다. 네이티브 <select> 세 개는
 * 모바일에서 휠 피커로 뜨고, 키보드·스크린리더가 그냥 동작한다.
 *
 * 연도 목록은 쓰는 쪽이 준다 — 생년월일은 과거로, 계약 예정일은 앞으로 가야 한다.
 *
 * 세 칸을 다 고르기 전에는 빈 문자열을 올려보낸다. 반쯤 고른 상태가 날짜로
 * 저장되면 안 되고, 각 화면의 필수값 검증이 그 빈 값을 잡아준다.
 */
type Parts = { year: number | null; month: number | null; day: number | null };

const EMPTY: Parts = { year: null, month: null, day: null };

export default function DatePicker({
  id,
  label,
  years,
  value,
  onChange,
}: {
  /** 연도 칸의 id. 바깥 <label htmlFor> 과 묶을 때 쓴다. */
  id?: string;
  /** 접근성 이름의 뿌리. "생년월일" → "생년월일 년" / "생년월일 월" / "생년월일 일" */
  label: string;
  years: number[];
  /** YYYY-MM-DD, 또는 아직 안 고른 상태면 "" */
  value: string;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState<Parts>(() => fromISODate(value) ?? EMPTY);

  // 저장된 값은 마운트 뒤에 들어온다(localStorage) — 그때 목록에도 되살린다.
  useEffect(() => {
    const saved = fromISODate(value);
    if (saved) setParts(saved);
  }, [value]);

  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch };
    // 2월 30일 같은 날짜가 남지 않게 자른다 (3월 31일에서 2월로 바꾼 경우).
    if (next.year !== null && next.month !== null && next.day !== null) {
      next.day = Math.min(next.day, dayOptions(next.year, next.month).length);
    }
    setParts(next);
    onChange(
      next.year !== null && next.month !== null && next.day !== null
        ? toISODate(next.year, next.month, next.day)
        : ""
    );
  }

  const toNumber = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="flex gap-2">
      <select
        id={id}
        aria-label={`${label} 년`}
        className="input flex-[1.3]"
        value={parts.year ?? ""}
        onChange={(e) => update({ year: toNumber(e.target.value) })}
      >
        <option value="">년</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} 월`}
        className="input flex-1"
        value={parts.month ?? ""}
        onChange={(e) => update({ month: toNumber(e.target.value) })}
      >
        <option value="">월</option>
        {MONTH_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} 일`}
        className="input flex-1"
        value={parts.day ?? ""}
        onChange={(e) => update({ day: toNumber(e.target.value) })}
      >
        <option value="">일</option>
        {dayOptions(parts.year, parts.month).map((d) => (
          <option key={d} value={d}>
            {d}일
          </option>
        ))}
      </select>
    </div>
  );
}
