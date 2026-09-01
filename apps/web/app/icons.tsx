/**
 * 화면에서 쓰는 아이콘. 유니코드 글리프(−, +, ✓, ⚠️)를 아이콘 자리에 쓰지 않기 위해
 * 직접 그린다 — 글리프는 폰트에 따라 두께·크기·정렬이 제멋대로 달라진다.
 *
 * Stepper.tsx 의 뒤로가기·체크 아이콘과 같은 규칙: stroke 2, 라운드 캡, 24 그리드.
 */

type IconProps = { className?: string; size?: number };

function Svg({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
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
      className={className}
    >
      {children}
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 12h12" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6v12M6 12h12" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5L2.5 20h19L12 4.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.2v.3" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  );
}

/** 목록 줄 오른쪽. "누르면 더 있다"를 말한다. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

/** 결과 화면의 설명 항목. 같은 선 두께의 아이콘만 써서 플랫폼별 이모지 차이를 없앤다. */
export function StackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3L3.5 7.5 12 12l8.5-4.5L12 3z" />
      <path d="M5 11l7 3.8 7-3.8M5 15l7 3.8 7-3.8" />
    </Svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5A2.5 2.5 0 016.5 4H19v16H6.5A2.5 2.5 0 014 17.5v-11z" />
      <path d="M4 8h15M15 12h4v4h-4a2 2 0 010-4z" />
    </Svg>
  );
}

export function BankIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9h18L12 4 3 9zM5 19h14M6 9v7M10 9v7M14 9v7M18 9v7M3 20h18" />
    </Svg>
  );
}
