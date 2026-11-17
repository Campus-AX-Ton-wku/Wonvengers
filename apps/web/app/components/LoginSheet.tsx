"use client";

import { Button } from "./Button";
import { KakaoButton } from "./KakaoButton";
import PerkyCharacter from "./PerkyCharacter";
import { Sheet } from "./Sheet";
import { signIn } from "@/lib/auth";

/**
 * 로그인이 필요한 동작 앞의 시트 (11/17 — 월세 계산 · 찜하기). [로그인 없이 보기]는 없다.
 * [닫기] · Esc · 바깥은 그 화면에 머문다. 닫은 것을 기억하지 않는다.
 *
 * 제목 왼쪽에 인사하는 Perky(wave)를 작게 둔다 — 처음 계정을 만드는 순간이라 "반가워요"의 자리다.
 * 72px: 시안 가이드 '작게 72–96px' 의 아래 끝. 350px 시트에서 제목이 두 줄을 넘지 않는다.
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
    <Sheet
      title={title}
      description={description}
      visual={<PerkyCharacter state="wave" size={72} priority className="h-auto w-[72px] shrink-0" />}
      onClose={onClose}
    >
      <KakaoButton onClick={() => signIn(next)} />
      <Button size="screen" variant="text" onClick={onClose}>
        닫기
      </Button>
    </Sheet>
  );
}
