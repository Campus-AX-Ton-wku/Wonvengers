"use client";

import { useEffect, useState } from "react";
import { CircleCheck, ICON_MD } from "./icons";
import { Button } from "./Button";
import { appliedDayLabel } from "@/lib/applied";
import { seoulTodayISO } from "@/lib/date";
import { loadApplied, onLocalChange, setApplied } from "@/lib/storage";

/**
 * '신청을 마쳤어요' (11/23 ggue) — 신청 준비 화면 · 정책 상세에 둔다.
 * Perky 는 실제 신청 여부를 모른다 — 사용자가 직접 누르는 표시다. 누르면 "신청 완료 · 11월 23일" 줄로 바뀌고 [취소]로 되돌린다.
 * 표시한 지원금은 추천(지원금 탭 · 홈 · 알림함)과 관심 마감 알림에서 빠지고, 관심 탭 '신청 완료'에 모인다(lib/applied.ts).
 */
export function AppliedButton({ policyId, policyName }: { policyId: string; policyName: string }) {
  const [day, setDay] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => setDay(loadApplied()[policyId] ?? null);
    read();
    setReady(true);
    return onLocalChange(read);
  }, [policyId]);

  if (!ready) return null;

  if (day) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-control bg-ok-50 px-4 py-2">
        <p className="flex items-center gap-2 text-sm font-bold text-ok-700" aria-live="polite">
          <CircleCheck size={ICON_MD} aria-hidden="true" />
          신청 완료 · {appliedDayLabel(day)}
        </p>
        <Button
          variant="text"
          size="md"
          full={false}
          aria-label={`${policyName} 신청 완료 표시 취소`}
          onClick={() => setApplied(policyId, null)}
        >
          취소
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="screen" onClick={() => setApplied(policyId, seoulTodayISO())}>
      신청을 마쳤어요
    </Button>
  );
}
