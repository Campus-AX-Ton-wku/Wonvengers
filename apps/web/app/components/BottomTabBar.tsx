"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { loadListing, loadProfile, onLocalChange } from "@/lib/storage";
import { useSyncState } from "@/lib/sync";
import { TabIcon, type TabIconName } from "./TabIcons";

export type TabKey = "home" | "saved" | "calc" | "benefit" | "my";

/**
 * 탭 순서 (11/20 결정) — 계산이 Perky 의 메인 기능이라 가운데, 엄지가 가장 쉽게 닿는 자리에 둔다.
 * 찜은 홈에서 빠져 '관심' 탭이 따로 맡는다.
 */
const TABS: { key: TabKey; label: string; icon: TabIconName; href: string }[] = [
  { key: "home", label: "홈", icon: "home", href: "/home" },
  { key: "saved", label: "관심", icon: "saved", href: "/saved" },
  { key: "calc", label: "계산", icon: "calc", href: "/calculate" },
  { key: "benefit", label: "지원금", icon: "benefit", href: "/find/policies" },
  { key: "my", label: "내 정보", icon: "my", href: "/account" },
];

/**
 * 계산 탭이 열 화면. 계산을 마쳤으면 결과, 아니면 계산 시작.
 * 탭은 이동만 한다(Apple HIG '탭 막대는 이동에, 행동에 쓰지 않는다') — '계산하기' 버튼이 아니라
 * '내 계산' 자리다. 홈의 '결과 보기'와 같은 조건(내 집 정보 + 2층 답)을 쓴다.
 */
export function calcTabHref(): string {
  return loadListing() && loadProfile() ? "/result" : "/calculate";
}

/**
 * 하단 섬 탭 (디자인 캔버스 '하단 섬 내비게이션 설계', 11/20).
 *
 * 화면 아래에 떠 있는 둥근 막대다. 홈 · 관심 · 지원금 · 내 정보 · 계산 결과처럼 '탭의 첫 화면'에만 둔다.
 * 질문 · 계산 입력 · 서류 체크 같은 단계 화면에는 두지 않는다 — 한 가지 일에 집중하는 화면이고,
 * 그 화면들은 아래에 고정 버튼(StickyBottomAction)이 이미 있다.
 *
 * 로그인한 사람에게만 보인다. 홈 · 관심은 로그인한 사람만 들어갈 수 있어서, 로그인 전에 탭을 보이면
 * 누르는 순간 온보딩으로 튕긴다.
 *
 * 선택된 탭은 채운 아이콘 + 뒤의 연한 파랑 알약 + 굵은 글자 — 색 하나에 기대지 않는다.
 * 저장에 실패하면 '내 정보'에 점을 찍는다(상단바의 '저장 안 됨 · 다시 시도'와 같은 뜻, 내 계정 화면에서 다시 시도).
 *
 * 본문 끝에 섬 높이만큼 빈칸을 같이 그린다 — 마지막 카드가 섬 아래에 가리지 않게.
 */
export function BottomTabBar({ active }: { active: TabKey }) {
  const [signedIn, setSignedIn] = useState(false);
  const [calcHref, setCalcHref] = useState("/calculate");
  const sync = useSyncState();

  useEffect(() => {
    if (!isLoginAvailable()) return;
    const update = () => setSignedIn(hasStoredLogin());
    update();
    return onAuthChange(update);
  }, []);

  useEffect(() => {
    const read = () => setCalcHref(calcTabHref());
    read();
    return onLocalChange(read);
  }, []);

  if (!signedIn) return null;
  const failed = sync.status === "error";

  return (
    <>
      <div aria-hidden="true" data-testid="tab-bar-spacer" className="h-[calc(6.5rem+env(safe-area-inset-bottom))] shrink-0" />
      <nav
        aria-label="주요 메뉴"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto mx-auto flex w-[calc(100%-2.5rem)] max-w-[380px] gap-0.5 rounded-full bg-surface/80 p-1 shadow-island backdrop-blur-xl backdrop-saturate-150">
          {TABS.map((tab) => {
            const on = tab.key === active;
            const href = tab.key === "calc" ? calcHref : tab.href;
            const alert = tab.key === "my" && failed;
            return (
              <Link
                key={tab.key}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`focus-ring relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-colors ${
                  on ? "bg-brand-600/12 text-brand-600" : "text-ink-600 hover:bg-ink-100/70 active:bg-ink-200/70"
                }`}
              >
                <span className="relative">
                  <TabIcon name={tab.icon} filled={on} />
                  {alert && <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-2 rounded-full bg-warn-800 ring-2 ring-surface" />}
                </span>
                <span className={`text-[11px] leading-tight ${on ? "font-bold text-brand-700" : "font-semibold"}`}>
                  {tab.label}
                  {alert && <span className="sr-only"> (저장 안 됨)</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
