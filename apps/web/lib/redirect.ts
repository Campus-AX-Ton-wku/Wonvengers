/**
 * 페이지 밖으로 나가는 이동. 한곳에 모은 이유는 테스트다 — jsdom 의 window.location 은
 * 고칠 수도 엿볼 수도 없어서, 테스트는 이 모듈을 대역으로 바꾼다.
 */
export function goTo(url: string): void {
  window.location.assign(url);
}

/** 기록을 남기지 않고 옮긴다(콜백·동의 화면에서 뒤로가기로 되돌아오지 않게). */
export function replacePage(url: string): void {
  window.location.replace(url);
}

/** 사본을 서버 값으로 바꾼 뒤 화면을 처음부터 다시 그린다. */
export function reloadPage(): void {
  window.location.reload();
}
