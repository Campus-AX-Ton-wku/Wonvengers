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
