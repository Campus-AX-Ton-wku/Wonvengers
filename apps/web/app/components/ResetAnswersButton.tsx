"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replaceKeepingEntry } from "@/lib/navigation";
import { resetAllAnswers } from "@/lib/storage";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/** 지운 뒤 가는 곳. 첫 질문이다. */
export const RESET_TARGET = "/find?q=birth";

/**
 * "처음부터 다시" (설계 '화면' 7). 따로 화면에 들어가지 않고 답을 고르는 흐름 안에 둔다 —
 * /find 의 답 요약 줄 끝, /find/policies 의 "조건 수정" 옆, /find/result 의 하단 CTA 아래.
 *
 * 지운 뒤 replace 한다. push 하면 뒤로가기가 방금 지운 화면(빈 결과)으로 돌아간다. 지금 칸이 이 탭의
 * 첫 화면이면 그 표도 옮긴다(replaceKeepingEntry). 로그인 전·후 똑같이 동작하고, 로그인 상태면
 * lib/sync.ts 가 비운 데이터를 바로 올린다.
 *
 * onReset: 같은 화면(/find)에 머무는 경우 그 화면의 상태도 비우라고 부른다.
 */
export function ResetAnswersButton({ onReset }: { onReset?: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  function reset() {
    resetAllAnswers();
    onReset?.();
    setConfirming(false);
    replaceKeepingEntry(router, RESET_TARGET);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="focus-ring inline-flex min-h-11 shrink-0 items-center rounded-control px-2 text-sm font-bold text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700"
      >
        처음부터 다시
      </button>
      {confirming && (
        <Sheet title="고른 답을 모두 지우고 첫 질문부터 다시 할까요?" onClose={() => setConfirming(false)}>
          <Button size="screen" onClick={reset}>
            다시 하기
          </Button>
          <Button size="screen" variant="text" onClick={() => setConfirming(false)}>
            취소
          </Button>
        </Sheet>
      )}
    </>
  );
}
