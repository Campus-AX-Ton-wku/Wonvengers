"use client";

import { useRouter } from "next/navigation";
import { Button, KakaoButton, Sheet } from "@/app/components";
import { signIn } from "@/lib/auth";
import { dismissSignup } from "@/lib/storage";

/** 로그인 뒤에도, 로그인하지 않아도 가는 곳. 시트를 띄운 CTA 의 목적지다. */
export const SIGNUP_NEXT = "/find/policies";

/**
 * 가입 제안 (설계 '화면' 1). 결과를 막지 않는다 — 닫거나 "로그인 없이 보기"를 누르면 바로 목록이다.
 * [로그인 없이 보기]·Esc·바깥 누르기가 모두 '닫음'이고 그 기기에서는 다시 띄우지 않는다.
 * [카카오로 계속하기]는 닫음으로 치지 않는다 — 카카오에서 취소하고 돌아오면 다시 볼 수 있다.
 */
export default function SignupSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet
      title="이 결과를 저장해 둘까요?"
      description="카카오로 3초 만에 저장하고, 다른 기기에서도 이어 보세요."
      onClose={() => {
        dismissSignup();
        onClose();
      }}
    >
      <KakaoButton onClick={() => void signIn(SIGNUP_NEXT)} />
      <Button
        size="screen"
        variant="text"
        onClick={() => {
          dismissSignup();
          router.push(SIGNUP_NEXT);
        }}
      >
        로그인 없이 보기
      </Button>
    </Sheet>
  );
}
