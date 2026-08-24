/**
 * 금액을 만·억 단위로 끊어 읽어준다 (F1-8).
 *
 * 숫자 입력칸에 "400000"을 넣은 사람은 그게 40만원인지 4만원인지 세어봐야 안다.
 * 입력하는 즉시 "40만원"을 옆에 보여주면 0 하나 더/덜 넣은 실수를 바로 잡는다.
 */
export function formatKoreanMoney(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0원";

  const 억 = Math.floor(amount / 100_000_000);
  const 만 = Math.floor((amount % 100_000_000) / 10_000);
  const 원 = Math.floor(amount % 10_000);

  const parts: string[] = [];
  if (억 > 0) parts.push(`${억.toLocaleString()}억`);
  if (만 > 0) parts.push(`${만.toLocaleString()}만`);
  if (원 > 0) parts.push(원.toLocaleString());

  return `${parts.join(" ")}원`;
}

/**
 * 금액 입력은 만원 단위로 받는다 (3 → 30,000원).
 *
 * 월세·보증금은 자릿수가 길어 "350000" 을 넣다가 0 을 하나 더/덜 치는 실수가 잦다.
 * 저장·계산은 그대로 원 단위이고, 입력칸에서만 만원으로 바꿔 주고받는다.
 */
export const WON_PER_MANWON = 10_000;

/** 입력칸의 만원 값 → 저장할 원 단위 금액. 5.5 → 55,000원. */
export function manwonToWon(manwon: number): number {
  if (!Number.isFinite(manwon) || manwon <= 0) return 0;
  return Math.round(manwon * WON_PER_MANWON);
}

/** 저장된 원 단위 금액 → 입력칸에 보여줄 만원 값. 0 이하는 빈 칸으로 둔다. */
export function wonToManwon(won: number): number | null {
  if (!Number.isFinite(won) || won <= 0) return null;
  return won / WON_PER_MANWON;
}
