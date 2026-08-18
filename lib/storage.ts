import type { Answers } from "@/lib/types";

const KEY = "perky.answers";

export const EMPTY_ANSWERS: Answers = {
  age: null,
  region: null,
  status: null,
  incomeBracket: null,
};

/**
 * 저장된 답변을 읽는다. 서버 렌더링 중에는 localStorage 가 없으므로 빈 답변을 준다.
 * 저장된 값이 깨져 있어도 화면이 죽지 않도록 오류를 삼킨다.
 */
export function loadAnswers(): Answers {
  if (typeof window === "undefined") return EMPTY_ANSWERS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_ANSWERS;
    return { ...EMPTY_ANSWERS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_ANSWERS;
  }
}

/** 답변을 브라우저에만 저장한다. 서버로 보내지 않는다. (PRD F0-13) */
export function saveAnswers(answers: Answers): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 한다.
  }
}
