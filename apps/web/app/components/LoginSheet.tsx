"use client";

import { Button } from "./Button";
import { KakaoButton } from "./KakaoButton";
import { Sheet } from "./Sheet";
import { signIn } from "@/lib/auth";

/**
 * 로그인이 필요한 동작 앞의 시트 (11/17 — 월세 계산 · 찜하기). [로그인 없이 보기]는 없다.
 * [닫기] · Esc · 바깥은 그 화면에 머문다. 닫은 것을 기억하지 않는다.
 */
export function LoginSheet({
  title,
  description,
  next,
  onClose,
}: {
  title: string;
  description: string;
  /** 로그인한 뒤 돌아올 곳 */
  next: string;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} description={description} onClose={onClose}>
      <KakaoButton onClick={() => signIn(next)} />
      <Button size="screen" variant="text" onClick={onClose}>
        닫기
      </Button>
    </Sheet>
  );
}
