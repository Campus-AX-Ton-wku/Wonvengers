"use client";

import Onboarding, { ONBOARDING_LAST } from "@/app/onboarding/Onboarding";

/**
 * 시작 화면 — 소개를 이미 본 비회원이 / 로 들어오면 여기로 온다(lib/start-redirect.ts).
 * 소개 마지막 장부터 그린다: [내 혜택 찾아보기] · [카카오로 로그인]. [이전]으로 소개를 다시 볼 수 있다.
 *
 * 따로 주소를 둔 이유: 정적 export 라 /onboarding 은 1장으로 구워진다. 같은 주소에서 마지막 장으로 넘기면
 * 1장이 한 번 그려진 뒤 바뀌어 깜빡인다. 이 주소는 처음부터 마지막 장으로 구워진다.
 */
export default function StartPage() {
  return <Onboarding initialStep={ONBOARDING_LAST} />;
}
