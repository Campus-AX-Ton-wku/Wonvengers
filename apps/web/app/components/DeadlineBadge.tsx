import { Ban, CalendarDays, Clock, InfinityIcon } from "./icons";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

/**
 * 마감 표시(lib/preparation.ts deadlineLabel) → 배지. 색만으로 말하지 않게 아이콘이 늘 붙는다.
 * 7일 이하로 남으면 danger (StatusBadge 'danger' — 공식 마감까지 7일 이하인 긴급 행동 상태).
 * 홈 미리 보기와 관심 탭 찜 카드가 같이 쓴다.
 */
export function DeadlineBadge({ label }: { label: string }) {
  const days = /^D-(\d+)$/.exec(label);
  let tone: BadgeTone = "muted";
  let icon = Ban;
  if (label === "상시") [tone, icon] = ["info", InfinityIcon];
  else if (label === "신청 예정") [tone, icon] = ["info", CalendarDays];
  else if (label === "오늘 마감") [tone, icon] = ["danger", Clock];
  else if (days) [tone, icon] = [Number(days[1]) <= 7 ? "danger" : "outline", Clock];
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  );
}
