import { Ban, CircleAlert, CircleCheck, CircleSlash, Clock, ICON_SM, Info, TriangleAlert } from "./icons";
import type { DiscoveryCardStatus } from "@/lib/types";

/**
 * 판정 상태 배지.
 *
 * 색만으로 상태를 말하지 않는다 — 배지마다 아이콘이 하나씩 붙는다. 색각 이상이나
 * 흑백 인쇄·캡처에서도 초록/주황이 아니라 체크/느낌표로 구분된다.
 *
 * 라벨은 자식 텍스트 노드로 그대로 둔다(감싸는 span 없이). 테스트가
 * `getByText("가능성 있음")` 으로 배지 자체를 집어 색 클래스를 검사한다 —
 * 한 겹 더 감싸면 클래스가 붙은 요소를 놓친다.
 */
export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "muted" | "info" | "outline";

const TONE: Record<BadgeTone, { className: string; Icon: typeof CircleCheck }> = {
  /** 조건에 맞고 지금 행동할 수 있다. */
  ok: { className: "bg-ok-50 text-ok-700", Icon: CircleCheck },
  /** 판단을 보류했다. 사용자가 더 답하면 풀린다. */
  warn: { className: "bg-warn-50 text-warn-800", Icon: TriangleAlert },
  /** 신청 가능하지만 공식 마감까지 7일 이하인 긴급 행동 상태다. */
  danger: { className: "bg-danger-50 text-danger-700", Icon: CircleAlert },
  /** 대상이 아니다. */
  neutral: { className: "bg-ink-100 text-ink-700", Icon: CircleSlash },
  /**
   * 조건은 맞지만 지금은 못 받는다(접수 마감). 초록을 주면 문구를 읽기 전에
   * 잘못 안심시킨다 — 색은 행동할 수 있는 상태에만 남긴다.
   */
  muted: { className: "bg-ink-100 text-ink-600", Icon: Ban },
  info: { className: "bg-brand-50 text-brand-800", Icon: Info },
  /**
   * 마감까지 여유가 있는 날짜(D-8 이상). 사실을 알릴 뿐 행동을 재촉하지 않아 면을 칠하지 않는다 —
   * 7일 이하가 되면 danger 로 넘어간다 (app/home/page.tsx).
   */
  outline: { className: "bg-surface text-ink-700 ring-1 ring-inset ring-ink-200", Icon: Clock },
};

/**
 * 1층 카드 상태 → 톤·아이콘. 목록·상세가 같은 표를 쓴다.
 *
 * '신청 예정'은 파랑(정보)이고 시계다 — 초록을 주면 지금 신청할 수 있다는 뜻이
 * 되고, 회색을 주면 끝난 사업처럼 읽힌다. 기다리면 되는 상태는 그 둘 중 어느
 * 쪽도 아니다.
 */
export const CARD_STATUS_BADGE: Record<
  DiscoveryCardStatus,
  { tone: BadgeTone; icon: typeof CircleCheck }
> = {
  "신청 가능": { tone: "ok", icon: CircleCheck },
  "확인 필요": { tone: "warn", icon: TriangleAlert },
  "신청 예정": { tone: "info", icon: Clock },
  "접수 마감": { tone: "muted", icon: Ban },
  "대상 아님": { tone: "neutral", icon: CircleSlash },
};

export function StatusBadge({
  tone,
  icon,
  children,
  size = "sm",
  className = "",
}: {
  tone: BadgeTone;
  /** md — 목록 카드의 금액 줄 오른쪽 알약(28px · 13px, 11/23 지원금 탭 시안). 그 밖은 sm. */
  size?: "sm" | "md";
  /**
   * 톤의 기본 아이콘을 덮는다.
   *
   * 1층 마감 카드가 이 자리를 쓴다. 그 카드의 태그는 여전히 '가능성 있음'인데
   * (태그는 나이·지역·상태·소득만 본다 — PRD F3-6) 색만 muted 로 뺀다. 톤의
   * 기본 아이콘(Ban)을 그대로 두면 "🚫 가능성 있음" 이라는 자기모순이 된다.
   */
  icon?: typeof CircleCheck;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon: ToneIcon } = TONE[tone];
  const Icon = icon ?? ToneIcon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ${
        size === "md" ? "h-7 pl-2 pr-2.5 text-[13px]" : "px-2.5 py-1 text-[11px]"
      } ${toneClass} ${className}`}
    >
      <Icon size={size === "md" ? ICON_SM : ICON_SM - 2} strokeWidth={size === "md" ? 2 : 2.5} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}
