"use client";

import { Button, KakaoButton, Sheet } from "@/app/components";
import { signIn } from "@/lib/auth";

/** 로그인한 뒤 돌아올 곳 — 월세 계산(2층). */
export const LOGIN_NEXT = "/calculate";

/**
 * 월세 계산 전 로그인 (11/17 팀 결정 — 손필기 ①②).
 *
 * 정책 목록까지는 로그인 없이 본다. "지원받으면 내 월세는 얼마일까?"를 누를 때 이 시트가 뜨고,
 * 계산은 로그인해야 이어진다 — [로그인 없이 보기]는 없다. [닫기] · Esc · 바깥을 누르면 목록에 그대로 머문다.
 * 닫은 것을 기억하지 않는다 — 다음에 누르면 다시 뜬다.
 */
export default function LoginSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="로그인하고 계산해 볼까요?"
      description="카카오로 3초 만에 로그인하면 지원받은 뒤 내 주거비를 계산하고, 다른 기기에서도 이어 볼 수 있어요."
      onClose={onClose}
    >
      <KakaoButton onClick={() => signIn(LOGIN_NEXT)} />
      <Button size="screen" variant="text" onClick={onClose}>
        닫기
      </Button>
    </Sheet>
  );
}
