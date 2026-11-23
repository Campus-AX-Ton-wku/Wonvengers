/**
 * 아래 알림(토스트) — 한 동작이 됐다고 짧게 알린다 (11/23 ggue, 토스 영상 #3 · #4).
 * 띄우는 곳은 showToast 만 부르고, 그리는 것은 루트 레이아웃의 ToastHost 하나다.
 */

export interface ToastInput {
  message: string;
  /** 오른쪽 작은 버튼 — "보러가기" 처럼 바로 이어 갈 곳 */
  action?: { label: string; href: string };
}

type Listener = (toast: ToastInput) => void;

const listeners = new Set<Listener>();

export function showToast(toast: ToastInput): void {
  for (const listener of listeners) listener(toast);
}

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
