"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasStoredLogin, isLoginAvailable, onAuthChange, signIn } from "@/lib/auth";
import { useSyncState } from "@/lib/sync";
import { KakaoButton } from "./KakaoButton";
import { TabIcon, type TabIconName } from "./TabIcons";

export type TabKey = "home" | "saved" | "benefit" | "ledger" | "my";

/**
 * 탭 순서 (11/21 시안 '하단 섬 · 상단바 설계' 확정) — 탭은 '자주 돌아오는 곳'만 둔다.
 * 계산 탭은 뺐다: 계산은 홈이 맡는다(계산 전 '내 월세 계산하기' · 계산 뒤 주거비 상자), 그 밖의 입구는
 * 달력 빈 화면 [계산하기] · 결과 맨 아래 [다른 방으로 다시 계산하기]. 빈 자리에 주거비 달력(/ledger)이 들어왔다.
 */
const TABS: { key: TabKey; label: string; icon: TabIconName; href: string }[] = [
  { key: "home", label: "홈", icon: "home", href: "/home" },
  { key: "saved", label: "관심", icon: "saved", href: "/saved" },
  { key: "benefit", label: "지원금", icon: "benefit", href: "/find/policies" },
  { key: "ledger", label: "달력", icon: "ledger", href: "/ledger" },
  { key: "my", label: "내 정보", icon: "my", href: "/account" },
];

/**
 * 하단 섬 탭 (디자인 캔버스 '하단 섬 · 상단바 설계').
 *
 * 화면 아래에 떠 있는 둥근 막대다. 홈 · 관심 · 지원금 · 달력 · 내 정보처럼 '탭의 첫 화면'과 그 하위 화면(결과 → 홈에 불)에 둔다.
 * 질문 · 계산 입력 · 서류 체크 같은 단계 화면에는 두지 않는다 — 한 가지 일에 집중하는 화면이고,
 * 그 화면들은 아래에 고정 버튼(StickyBottomAction)이 이미 있다.
 *
 * 탭은 로그인한 사람에게만 보인다. 홈 · 관심 · 달력은 로그인한 사람만 들어갈 수 있어서, 로그인 전에 탭을 보이면
 * 누르는 순간 온보딩으로 튕긴다. 그 자리에 비회원에게는 [카카오로 로그인하고 홈으로]를 띄운다(11/22) — 없으면 질문을 다 끝낸
 * 화면(지원금 목록 · 결과)에서 홈으로 갈 길이 없다. 내 정보 화면은 본문에 이미 카카오 버튼이 있어 띄우지 않는다.
 *
 * 선택된 탭은 채운 아이콘 + 뒤의 연한 파랑 알약 + 굵은 글자 — 색 하나에 기대지 않는다.
 * 저장에 실패하면 '내 정보'에 점을 찍는다(상단바의 '저장 안 됨 · 다시 시도'와 같은 뜻, 내 계정 화면에서 다시 시도).
 *
 * 본문 끝에 섬 높이만큼 빈칸을 같이 그린다 — 마지막 카드가 섬 아래에 가리지 않게.
 *
 * guestAction 을 주면 비회원 버튼의 문구와 로그인 뒤 돌아갈 곳을 바꾼다. 지원금 목록은 이 버튼과 본문의 계산 버튼을
 * 하나로 합쳐 [카카오로 로그인하고 내 최종 주거비 확인하기] → /calculate 로 쓴다(11/23) — 둘이 같이 있으면 노란 버튼이
 * 파란 버튼을 덮고, 어느 쪽을 눌러도 결국 카카오 로그인이다.
 */
export interface GuestAction {
  label: React.ReactNode;
  returnTo: string;
}

const DEFAULT_GUEST_ACTION: GuestAction = { label: "카카오로 로그인하고 홈으로", returnTo: "/home" };

export function BottomTabBar({ active, guestAction = DEFAULT_GUEST_ACTION }: { active: TabKey; guestAction?: GuestAction }) {
  const [signedIn, setSignedIn] = useState(false);
  const [available, setAvailable] = useState(false);
  const sync = useSyncState();

  useEffect(() => {
    if (!isLoginAvailable()) return;
    setAvailable(true);
    const update = () => setSignedIn(hasStoredLogin());
    update();
    return onAuthChange(update);
  }, []);

  const spacer = <div aria-hidden="true" data-testid="tab-bar-spacer" className="h-[calc(6.5rem+env(safe-area-inset-bottom))] shrink-0" />;

  if (!signedIn) {
    if (!available || active === "my") return null;
    return (
      <>
        {spacer}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto w-[calc(100%-2.5rem)] max-w-[380px] rounded-[12px] shadow-island">
            <KakaoButton onClick={() => signIn(guestAction.returnTo)}>{guestAction.label}</KakaoButton>
          </div>
        </div>
      </>
    );
  }
  const failed = sync.status === "error";

  return (
    <>
      {spacer}
      <nav
        aria-label="주요 메뉴"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto mx-auto flex w-[calc(100%-2.5rem)] max-w-[380px] gap-0.5 rounded-full bg-surface/80 p-1 shadow-island backdrop-blur-xl backdrop-saturate-150">
          {TABS.map((tab) => {
            const on = tab.key === active;
            const alert = tab.key === "my" && failed;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`focus-ring relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-colors ${
                  on ? "bg-brand-600/12 text-brand-600" : "text-ink-600 hover:bg-ink-100/70 active:bg-ink-200/70"
                }`}
              >
                <span className="relative">
                  <TabIcon name={tab.icon} filled={on} />
                  {alert && <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-2 rounded-full bg-warn-800 ring-2 ring-surface" />}
                </span>
                <span className={`text-[12px] leading-tight ${on ? "font-bold text-brand-700" : "font-semibold"}`}>
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
