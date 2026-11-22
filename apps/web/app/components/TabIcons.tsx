/**
 * 하단 섬 탭 · 상단바 종 아이콘 (디자인 캔버스 '하단 섬 내비게이션 설계', 11/20).
 *
 * lucide(icons.tsx)와 같은 규격이다 — 24 격자, 선 2, 둥근 끝. 그래서 옆에 놓여도 굵기가 같다.
 * 탭 아이콘만 따로 그린 이유는 '선택됨' 모양이 필요해서다: 선택한 탭은 같은 모양을 꽉 채우고
 * 안쪽 기호(문 · 체크 · ₩)만 비운다. 색만으로 선택을 말하지 않는다(WCAG 1.4.1).
 * 다른 앱 아이콘을 옮기지 않고 기본 도형(집 · 하트 · 동전 · 달력 · 사람 · 종)으로 새로 그렸다.
 */

export type TabIconName = "home" | "saved" | "benefit" | "ledger" | "my" | "bell";

/** 채운 모양 안쪽 기호는 카드 · 섬 바탕색(surface)이다 — 다크에서도 뚫린 자리처럼 보인다. */
const HOUSE = "M4 10.6c0-.6.3-1.2.8-1.6l6.4-5.2a1.3 1.3 0 0 1 1.6 0l6.4 5.2c.5.4.8 1 .8 1.6V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z";
/** 채운 집은 문 자리를 비운 한 줄 윤곽이다 — 흰 문을 덧그리지 않아 섬의 연한 파랑 바탕이 그대로 비친다. */
const HOUSE_WITH_DOOR =
  "M4 10.6c0-.6.3-1.2.8-1.6l6.4-5.2a1.3 1.3 0 0 1 1.6 0l6.4 5.2c.5.4.8 1 .8 1.6V19a2 2 0 0 1-2 2H15v-3.5a3 3 0 0 0-6 0V21H6a2 2 0 0 1-2-2Z";
const HEART =
  "M18.02 13.72c1.28-1.26 2.58-2.76 2.58-4.73A4.73 4.73 0 0 0 15.87 4.26c-1.51 0-2.58.43-3.87 1.72-1.29-1.29-2.36-1.72-3.87-1.72A4.73 4.73 0 0 0 3.4 8.99c0 1.98 1.29 3.48 2.58 4.73L12 19.74Z";
const WON = "m8.1 8.9 1.7 6.2L12 10.3l2.2 4.8 1.7-6.2";
const WON_BAR = "M7.6 12.4h8.8";
const BODY_OPEN = "M4.5 20.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6";
const BODY_CLOSED = "M4.5 20.2c.8-3.4 3.9-5.7 7.5-5.7s6.7 2.3 7.5 5.7a.9.9 0 0 1-.9 1.1H5.4a.9.9 0 0 1-.9-1.1Z";
const BELL = "M6 10a6 6 0 0 1 12 0v4.1l1.5 2.3a1 1 0 0 1-.8 1.6H5.3a1 1 0 0 1-.8-1.6L6 14.1Z";
function shape(name: TabIconName, filled: boolean) {
  switch (name) {
    case "home":
      return filled ? (
        <path d={HOUSE_WITH_DOOR} fill="currentColor" />
      ) : (
        <>
          <path d={HOUSE} />
          <path d="M9.5 21v-3.5a2.5 2.5 0 0 1 5 0V21" />
        </>
      );
    case "saved":
      return <path d={HEART} fill={filled ? "currentColor" : "none"} />;
    case "ledger":
      // 시안 '하단 섬 · 상단바 설계'(11/21) — 몸통 + 고리 둘 + 체크(달력의 [냈어요] 체크와 같은 뜻)
      return (
        <>
          <rect x={3.5} y={5} width={17} height={16} rx={3} fill={filled ? "currentColor" : "none"} />
          <path d="M8 3v4M16 3v4" />
          <path d="M4.6 10h14.8" className={filled ? "stroke-surface" : undefined} strokeWidth={filled ? 1.6 : 2} />
          <path d="m9.2 15.3 2 2 3.8-4" className={filled ? "stroke-surface" : undefined} />
        </>
      );
    case "benefit":
      return (
        <>
          <circle cx={12} cy={12} r={9} fill={filled ? "currentColor" : "none"} />
          <path d={WON} className={filled ? "stroke-surface" : undefined} />
          <path d={WON_BAR} className={filled ? "stroke-surface" : undefined} />
        </>
      );
    case "my":
      return filled ? (
        <>
          <circle cx={12} cy={8} r={3.8} fill="currentColor" />
          <path d={BODY_CLOSED} fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx={12} cy={8} r={3.8} />
          <path d={BODY_OPEN} />
        </>
      );
    case "bell":
      return (
        <>
          <path d={BELL} fill={filled ? "currentColor" : "none"} />
          <path d="M10 21h4" />
        </>
      );
  }
}

export function TabIcon({
  name,
  filled = false,
  size = 24,
  className,
}: {
  name: TabIconName;
  /** 선택된 탭 — 꽉 채운 모양 */
  filled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-tab-icon={name}
      data-filled={filled || undefined}
      className={className}
    >
      {shape(name, filled)}
    </svg>
  );
}
