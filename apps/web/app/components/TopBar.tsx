"use client";

import { useBack } from "@/lib/navigation";
import { AccountSlot } from "./AccountSlot";
import { ArrowLeft, ICON_LG } from "./icons";
import { IconButton } from "./IconButton";
import { Wordmark } from "./Wordmark";

/** 화면마다 8종이던 뒤로 문구를 하나로 모았다 (docs/기획/2026-11-03-단계-이동-설계.md). */
const BACK_LABEL = "이전 단계로";

/**
 * 모든 내부 화면의 상단 바. 뒤로가기 + 계정 칸.
 *
 * 화살표는 휴대폰 뒤로가기와 같다(lib/navigation.ts 의 useBack). 앞 화면이 이 앱 안이면
 * history.back(), 이 탭에서 처음 들어온 화면이면 backHref 로 간다 — 목록·결과 화면은 링크로
 * 바로 들어올 수 있어서 앞 화면이 앱 밖일 수 있다. 예전에는 화살표가 backHref 로 새로
 * 이동해 기록이 쌓였고, 그 뒤 휴대폰 뒤로가기가 방금 떠난 화면으로 되돌아갔다.
 *
 * 가운데 브랜드(Perky 로고 → /)는 11/17 에 뺐다. 결과까지 본 사람이 누르면 처음 화면으로 가서 답을 다시
 * 넣게 됐고, 답 비우기는 '처음부터 다시'가 맡는다. 줄은 양 끝 배치다.
 * 홈 화면(home)만 왼쪽에 로고를 둔다 — 링크가 아니다.
 * 오른쪽 칸은 right 를 넘기지 않으면 계정 칸(AccountSlot — 로그인 후 알림 종 · 저장 알림)이다. 로그인 전에는
 * 그 칸도 빈 자리다 (docs/기획/2026-11-04-카카오-로그인-설계.md '화면' 4). 로그인 흐름 화면(/auth/*)은 빈 자리를 넘긴다.
 * [홈] · [내 계정]은 11/20 하단 섬 탭(BottomTabBar)으로 옮겼다 — 이동은 아래, 상단바에는 도구만.
 *
 * 배경이 canvas 인 이유: sticky 로 붙었을 때 아래 본문이 비쳐 지나가면 안 된다.
 */
export function TopBar({
  backHref,
  home = false,
  right,
}: {
  /** 앞 화면이 앱 밖일 때 갈 곳. 없으면 화살표를 그리지 않는다. */
  backHref?: string;
  /**
   * @deprecated 문구는 "이전 단계로" 하나다. app/result/ResultState.tsx(손대지 않는 파일)가
   * 아직 넘기므로 받기만 하고 쓰지 않는다.
   */
  backLabel?: string;
  /** 홈 화면(/home) — 왼쪽에 로고. */
  home?: boolean;
  right?: React.ReactNode;
}) {
  return (
    /* 44px 버튼 안 24px 아이콘의 좌우 여백은 10px이다. 헤더 패딩을 320px에서
       6px, 390px 이상에서 10px로 주면 아이콘 끝이 각 본문 gutter(16/20px)에 맞는다. */
    <header className="sticky top-0 z-20 -mx-4 bg-canvas px-1.5 pt-[env(safe-area-inset-top)] min-[390px]:-mx-5 min-[390px]:px-2.5">
      <div data-testid="top-bar-row" className="flex h-14 items-center justify-between">
        <div data-testid="top-bar-left" className="flex">
          {home ? (
            /* 아이콘 버튼 안 여백(10px)만큼 띄워 로고 왼쪽 끝을 본문 gutter 에 맞춘다. */
            <span className="flex min-h-11 items-center px-2.5">
              <Wordmark />
            </span>
          ) : backHref ? (
            <BackButton backHref={backHref} />
          ) : (
            <span className="w-11" aria-hidden="true" />
          )}
        </div>

        <div data-testid="top-bar-right" className="flex">
          {right ?? <AccountSlot />}
        </div>
      </div>
    </header>
  );
}

/** 훅은 조건부로 부를 수 없어서 화살표를 따로 뺐다. backHref 가 있을 때만 그린다. */
function BackButton({ backHref }: { backHref: string }) {
  const back = useBack(backHref);
  return (
    <IconButton label={BACK_LABEL} onClick={back}>
      <ArrowLeft size={ICON_LG} aria-hidden="true" />
    </IconButton>
  );
}
