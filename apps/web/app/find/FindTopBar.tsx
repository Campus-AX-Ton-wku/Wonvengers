import Link from "next/link";
import { HomeMark } from "@/app/Stepper";

/**
 * 1층 화면의 상단 바. 2층 AppBar 와 높이·정렬을 맞추되 진행률은 두지 않는다.
 *
 * 뒤로가기는 history.back() 대신 목적지를 명시한 링크다. 목록 화면은 링크로
 * 바로 들어올 수 있어서, 히스토리에 앞 화면이 없을 수도 있다.
 */
export default function FindTopBar({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-10 -mx-5 bg-white px-1 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel ?? "이전 화면으로"}
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-100 active:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 19L8 12l7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : (
          <span className="w-12" aria-hidden="true" />
        )}
        <HomeMark />
        <span className="w-12" aria-hidden="true" />
      </div>
    </header>
  );
}
