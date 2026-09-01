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
