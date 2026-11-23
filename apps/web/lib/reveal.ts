/**
 * 결과 화면 앞 '찾았어요' 한 장 (11/23 시안 '찾았어요 화면 설계').
 *
 * 판정 질문 마지막 묶음에서 [결과 확인하기]를 누른 직후 한 번만 보인다. 표시는 sessionStorage 에 한 번
 * 쓰고, 결과 화면이 꺼내면서 지운다 — 홈 · 지원금 탭의 '계산 결과 보기', 뒤로 가기, 새로고침으로
 * 결과 화면을 다시 열면 표시가 없어 바로 결과가 나온다. 주소가 따로 없는 '막'이라 뒤로 가면
 * 판정 질문으로 돌아간다.
 */
export const REVEAL_KEY = "perky.reveal";

/** 판정 질문이 /result 로 보내기 직전에 부른다. 저장을 못 하면(사생활 보호 모드) 막 없이 결과로 간다. */
export function markReveal(): void {
  try {
    window.sessionStorage.setItem(REVEAL_KEY, "1");
  } catch {
    /* 막은 꾸밈이다 — 없어도 결과는 그대로 */
  }
}

/** 표시가 있었는지 돌려주고 지운다. 다시 부르면 false. */
export function takeReveal(): boolean {
  try {
    const marked = window.sessionStorage.getItem(REVEAL_KEY) === "1";
    window.sessionStorage.removeItem(REVEAL_KEY);
    return marked;
  } catch {
    return false;
  }
}
