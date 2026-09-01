import { ChevronDownIcon } from "@/app/icons";

/**
 * 카드 안 세부사항 접기.
 *
 * 네이티브 <details> 를 쓴다 — JS 없이 키보드·스크린리더가 동작하고, 정적 빌드에서도
 * 첫 페인트부터 접혀 있다. 이미 '해당되지 않는 지원금' 그룹이 같은 요소를 쓴다.
 *
 * 라벨에는 항목 수를 넣는다. 열지 않고도 안에 뭐가 얼마나 있는지 알 수 있어야
 * 접은 값이 사라진 것처럼 보이지 않는다.
 */
export default function Disclosure({
  label,
  children,
  className = "mt-3",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl bg-sand-50 px-3.5 py-3 text-sm font-bold text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <ChevronDownIcon size={16} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
