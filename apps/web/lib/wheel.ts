/**
 * 휠 데이트 피커의 치수와 인덱스 계산.
 *
 * 스크롤 자체는 jsdom 에서 검증할 수 없다(레이아웃이 없어 scrollTop 이 항상 0이다).
 * 그래서 "몇 번째 항목이 가운데 왔는가"를 여기 순수 함수로 빼서 node 테스트로 덮고,
 * 컴포넌트는 이 함수를 부르기만 한다. 굴러가는 감각은 실기기 QA 항목이다
 * (docs/기획/QA체크리스트.md).
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

/**
 * 타이핑 점프(type-ahead)가 버퍼를 비우기까지의 시간(ms).
 *
 * 네이티브 select 와 같은 1초로 둔다. 짧게 잡으면 "31" 을 치는 동안 버퍼가 끊겨
 * 3일로 가버리고, 길게 잡으면 다음에 누른 숫자가 앞 글자에 이어 붙는다.
 */
export const TYPE_AHEAD_MS = 1000;

/**
 * 눌린 숫자열로 갈 항목을 찾는다. 네이티브 select 처럼 **앞자리 일치**이고,
 * 목록 순서대로 처음 맞는 것을 준다.
 *
 *   월 목록 1~12 에서 "9" → 9,  "1" → 1,  "12" → 12
 *   생년 목록 2008~1981(내림차순)에서 "2003" → 2003,  "20" → 2008 (목록 순서상 먼저)
 *
 * 못 찾으면 null 이다. 호출하는 쪽이 버퍼를 버리고 마지막 글자로 다시 시도한다.
 */
export function typeAheadMatch(values: number[], buffer: string): number | null {
  if (!buffer) return null;
  const hit = values.find((v) => String(v).startsWith(buffer));
  return hit ?? null;
}
