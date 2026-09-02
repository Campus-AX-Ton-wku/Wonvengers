"use client";

import { ArrowLeft, ICON_LG } from "./icons";
import { IconButton, IconLink } from "./IconButton";
import { HomeMark } from "./Wordmark";

/**
 * 모든 내부 화면의 상단 바. 뒤로가기 + 브랜드.
 *
 * 뒤로가기는 두 가지로 온다 — 스텝 안에서는 함수(단계를 하나 되돌린다), 화면
 * 사이에서는 링크(목적지가 정해져 있다). history.back() 을 쓰지 않는 이유:
 * 목록·결과 화면은 링크로 바로 들어올 수 있어서 히스토리에 앞 화면이 없을 수 있다.
 *
 * 오른쪽 자리는 비어 있어도 폭을 잡는다. 그래야 가운데 브랜드가 화면 중앙에 온다.
 *
 * 배경이 canvas 인 이유: sticky 로 붙었을 때 아래 본문이 비쳐 지나가면 안 된다.
 */
export function TopBar({
  onBack,
  backHref,
  backLabel = "이전 화면으로",
  right,
}: {
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  const arrow = <ArrowLeft size={ICON_LG} aria-hidden="true" />;

  return (
    /* px-2.5 는 광학 정렬이다. 44px 버튼 안의 24px 아이콘은 좌우 10px 여백을 갖고,
       지면 여백이 20px 이므로 10+10 = 20 에서 아이콘 왼쪽 끝이 본문 왼쪽 끝과 맞는다.
       타깃은 44px 그대로 두고 여백만 되물린다. */
    <header className="sticky top-0 z-20 -mx-5 bg-canvas px-2.5 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between">
        {onBack ? (
          <IconButton label={backLabel} onClick={onBack}>
            {arrow}
          </IconButton>
        ) : backHref ? (
          <IconLink href={backHref} label={backLabel}>
            {arrow}
          </IconLink>
        ) : (
          <span className="w-11" aria-hidden="true" />
        )}

        <HomeMark />

        {right ?? <span className="w-11" aria-hidden="true" />}
      </div>
    </header>
  );
}
