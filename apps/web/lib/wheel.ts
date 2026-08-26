/**
 * 휠 데이트 피커의 치수와 인덱스 계산.
 *
 * 스크롤 자체는 jsdom 에서 검증할 수 없다(레이아웃이 없어 scrollTop 이 항상 0이다).
 * 그래서 "몇 번째 항목이 가운데 왔는가"를 여기 순수 함수로 빼서 node 테스트로 덮고,
 * 컴포넌트는 이 함수를 부르기만 한다. 굴러가는 감각은 실기기 QA 항목이다.
 */

/** 한 항목의 높이(px). CSS 와 반드시 같은 값을 써야 스냅 위치가 어긋나지 않는다. */
export const ITEM_HEIGHT = 40;

/** 한 번에 보이는 줄 수. 홀수여야 가운데 한 줄이 정확히 선택 위치가 된다. */
export const VISIBLE_ROWS = 5;

export const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

/**
 * 목록 위아래에 넣는 여백. 첫 항목과 마지막 항목도 가운데까지 올라와야 하므로
 * (컨테이너 높이 − 항목 높이) / 2 만큼 비워 둔다.
 */
export const WHEEL_PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

/** 스크롤 위치 → 가운데 온 항목의 인덱스. 목록 밖으로는 나가지 않는다. */
export function indexFromScroll(scrollTop: number, count: number): number {
  if (count <= 0) return 0;
  const raw = Math.round(scrollTop / ITEM_HEIGHT);
  return Math.min(Math.max(raw, 0), count - 1);
}

/** 인덱스 → 그 항목을 가운데 놓는 스크롤 위치. */
export function scrollTopForIndex(index: number): number {
  return Math.max(0, index) * ITEM_HEIGHT;
}

/** 왕복이 어긋나지 않는지 한 곳에서 보장한다. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}
