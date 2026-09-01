/**
 * 카드 — 지면 위에 올라온 흰 면.
 *
 * 지면(canvas)이 아주 옅은 파랑이라 흰 카드가 그것만으로 떠오른다. 예전에는
 * 지면도 카드도 흰색이라 hairline 없이는 구분이 안 됐다.
 *
 * tone
 *   plain  — 기본. 흰 면 + 얕은 그림자.
 *   flat   — 카드 안의 보조 블록. 그림자 없이 옅은 면으로만 구분한다.
 *            (카드 안의 카드는 만들지 않는다 — 그림자가 겹치면 깊이가 거짓말을 한다.)
 *   info   — 안내. 옅은 파랑.
 *   notice — 고지·면책. 회색 면, 본문 크기를 낮춘다.
 */
export type CardTone = "plain" | "flat" | "info" | "notice";

const TONE: Record<CardTone, string> = {
  plain: "bg-surface shadow-card",
  flat: "bg-ink-50",
  info: "bg-brand-50",
  notice: "bg-ink-100",
};

export function Card({
  tone = "plain",
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: {
  tone?: CardTone;
  as?: "div" | "section" | "article" | "aside";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-card p-5 ${TONE[tone]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
