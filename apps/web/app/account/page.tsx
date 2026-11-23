"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, BottomTabBar, Button, KakaoButton, LinkButton, Sheet, TopBar } from "@/app/components";
import { hasStoredLogin, isLoginAvailable, onAuthChange, rememberReturnTo, signIn } from "@/lib/auth";
import { goTo } from "@/lib/redirect";
import { isPushConfigured } from "@/lib/push";
import { ChevronRight, ICON_MD } from "@/app/components/icons";
import { flushNow, hasUnsyncedChanges, logout, retrySync, syncEnabled, useSyncState, withdraw } from "@/lib/sync";
import { ThemeSetting } from "./ThemeSetting";
import policiesJson from "@/data/policies.json";
import { seoulTodayISO } from "@/lib/date";
import { hasStartedPreparing } from "@/lib/preparation";
import {
  EMPTY_ANSWERS,
  loadAnswers,
  loadChecklist,
  loadDocumentChecks,
  loadLedger,
  loadBadges,
  loadProfileCard,
  loadSaved,
  onDeviceRecordChange,
  onLocalChange,
} from "@/lib/storage";
import type { DiscoveryAnswers, PolicyMeta } from "@/lib/types";
import type { BadgeId, ProfileCardData } from "@/lib/user-data";
import { MyRecords } from "./MyRecords";
import { BadgeSection } from "./BadgeSection";
import { badgeStatuses, type BadgeStatus } from "@/lib/badges";
import { readBadgeFacts } from "@/lib/badge-facts";
import { ProfileCardSection } from "./ProfileCardSection";

const POLICIES = policiesJson as PolicyMeta[];

interface Mine {
  answers: DiscoveryAnswers;
  card: ProfileCardData | null;
  saved: number;
  preparing: number;
  ledgerMonths: number;
  badgeStatuses: BadgeStatus[];
  earned: Partial<Record<BadgeId, string>>;
}

/** 내 기록 · 프로필에 쓰는 이 기기 값. 신청 준비 중 = 관심 지원금 중 체크리스트를 하나라도 체크한 것 (hasStartedPreparing, 11/23) */
function readMine(today: string): Mine {
  const saved = loadSaved();
  const preparing = saved.filter((id) => {
    const policy = POLICIES.find((x) => x.id === id);
    if (!policy) return false;
    return hasStartedPreparing(policy, loadChecklist(id), loadDocumentChecks(id));
  }).length;
  const ledgerMonths = Object.values(loadLedger().months).filter((m) => Object.keys(m.done).length > 0).length;
  return {
    answers: loadAnswers(),
    card: loadProfileCard(),
    saved: saved.length,
    preparing,
    ledgerMonths,
    badgeStatuses: badgeStatuses(readBadgeFacts(today)),
    earned: loadBadges(),
  };
}

/** 2026.11.04 18:00 — 이 기기 시간대로. */
function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 계정 (설계 '화면' 5). 로그인 상태, 마지막 저장 시각, 로그아웃, 회원 탈퇴, 처리방침 링크.
 * "저장된 답 지우기"는 따로 두지 않는다 — 답을 고르는 흐름 안의 '처음부터 다시'가 그 일을 한다.
 *
 * 회원 탈퇴가 끝나면 이 기기 사본을 지우고 로그아웃한 뒤 여기서 "탈퇴가 끝났어요"를 말한다.
 * Cognito 사용자는 이미 지워져서 Cognito 로그아웃 화면으로 보내지 않는다.
 *
 * 로그아웃은 이 기기의 사본을 지우고 Cognito 로 떠난다 — 지운 뒤에는 알릴 틈이 없다. 그래서 먼저 남은 쓰기를
 * 올려 보고(flushNow), 그래도 올리지 못한 변경·고르지 않은 충돌이 남으면 "저장 안 된 변경이 있어요"로 묻는다.
 */
export default function AccountPage() {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  /**
   * 로그인했는데 이 기기에 저장 동의가 없는가(동의 화면에서 고르지 않고 나간 경우, 11/23 ggue 실기기).
   * 그러면 앱이 조용히 저장을 멈추고 배지도 판정하지 않는다(BadgeWatcher 는 처음 동기화 뒤에만) — 동의로 가는 길을 보인다.
   */
  const [needsConsent, setNeedsConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const sync = useSyncState();
  const [mine, setMine] = useState<Mine>({
    answers: EMPTY_ANSWERS,
    card: null,
    saved: 0,
    preparing: 0,
    ledgerMonths: 0,
    badgeStatuses: [],
    earned: {},
  });
  const [today, setToday] = useState("");

  // 프로필 · 내 기록은 이 기기 사본에서 — 다른 기기에서 바꾼 값이 동기화로 들어오면 다시 읽는다
  useEffect(() => {
    const read = () => setMine(readMine(seoulTodayISO()));
    read();
    setToday(seoulTodayISO());
    const offLocal = onLocalChange(read);
    const offDevice = onDeviceRecordChange(read);
    return () => {
      offLocal();
      offDevice();
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const ok = isLoginAvailable();
      setAvailable(ok);
      setSignedIn(ok && hasStoredLogin());
      setNeedsConsent(ok && hasStoredLogin() && !syncEnabled());
    };
    update();
    setReady(true);
    return onAuthChange(update);
  }, []);

  function askConsent() {
    rememberReturnTo("/account");
    goTo("/auth/consent");
  }

  async function requestLogout() {
    setLoggingOut(true);
    await flushNow();
    if (hasUnsyncedChanges()) {
      setLoggingOut(false);
      setConfirmingLogout(true);
      return;
    }
    await logout();
  }

  async function confirmLogout() {
    setConfirmingLogout(false);
    setLoggingOut(true);
    await logout();
  }

  async function confirmWithdraw() {
    setWorking(true);
    setFailed(false);
    try {
      await withdraw();
      setWithdrawn(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  }

  const heading = "text-2xl font-extrabold leading-snug text-ink-900";
  const body = "text-sm leading-relaxed text-ink-600";

  return (
    <AppShell>
      {/* 탭 화면이라 뒤로 가기 없음 — 로그인했으면 상단바 왼쪽 제목 '내 정보'(11/22 내 프로필) */}
      <TopBar title={ready && available && signedIn && !withdrawn ? "내 정보" : undefined} />
      <main className="flex flex-1 flex-col gap-6 pb-10 pt-4">
        {!ready ? (
          <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
        ) : withdrawn ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>탈퇴가 끝났어요</h1>
            <p className={body}>
              저장된 답과 회원 정보를 모두 지웠어요.
            </p>
            <LinkButton href="/find" variant="secondary">
              질문으로 가기
            </LinkButton>
          </section>
        ) : !available ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>지금은 로그인을 쓸 수 없어요</h1>
            <p className={body}>로그인하지 않아도 모든 기능을 그대로 쓸 수 있어요. 답은 이 기기에만 저장돼요.</p>
          </section>
        ) : !signedIn ? (
          <section className="flex flex-col gap-3">
            <h1 className={heading}>로그인하지 않았어요</h1>
            <p className={body}>
              지금 고른 답은 이 기기에만 있어요. 카카오로 로그인하면 다른 기기에서도 이어 볼 수 있어요.
            </p>
            <KakaoButton onClick={() => signIn("/account")} />
          </section>
        ) : (
          <>
            {/* 11/22 내 프로필 — 프로필 카드 · 내 기록 · 설정 · 계정 순 (docs/기획/2026-11-22-내-프로필-설계.md §3) */}
            <ProfileCardSection
              card={mine.card}
              answers={mine.answers}
              today={today}
              earnedBadges={mine.badgeStatuses.map((s) => s.id).filter((id) => mine.earned[id])}
              onSaved={(card) => setMine((m) => ({ ...m, card }))}
            />
            <BadgeSection statuses={mine.badgeStatuses} earned={mine.earned} onConsent={needsConsent ? askConsent : undefined} />
            <MyRecords saved={mine.saved} preparing={mine.preparing} ledgerMonths={mine.ledgerMonths} />
            <Settings showNotifications={isPushConfigured()} />
            <section aria-labelledby="account-heading" className="flex flex-col gap-2.5">
              <h2 id="account-heading" className="text-base font-bold text-ink-900">
                계정
              </h2>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-600">
                <span>카카오로 로그인했어요</span>
                <span aria-hidden="true" className="text-ink-300">·</span>
                {needsConsent ? (
                  <span>이 기기에서는 아직 저장에 동의하지 않았어요</span>
                ) : (
                  <span>{sync.lastSavedAt ? `마지막 저장 ${formatSavedAt(sync.lastSavedAt)}` : "아직 저장 전이에요"}</span>
                )}
              </p>
              {needsConsent && (
                <Button variant="secondary" size="screen" onClick={askConsent}>
                  동의하고 저장
                </Button>
              )}
              {sync.status === "error" && (
                <div
                  role="status"
                  className="mt-1 flex items-center justify-between gap-3 rounded-control bg-warn-50 px-4 py-2 text-sm text-warn-800"
                >
                  <span>저장 안 된 변경이 있어요. 로그아웃하면 이 기기에서 사라져요.</span>
                  <Button variant="text" size="md" full={false} onClick={() => void retrySync()}>
                    다시 시도
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="quiet" size="screen" disabled={loggingOut} onClick={() => void requestLogout()}>
                  {loggingOut ? "로그아웃하는 중…" : "로그아웃"}
                </Button>
                <Button
                  variant="text"
                  size="md"
                  onClick={() => {
                    setFailed(false);
                    setConfirming(true);
                  }}
                >
                  회원 탈퇴
                </Button>
              </div>
              {failed && (
                <p role="alert" className="rounded-control bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  탈퇴하지 못했어요. 아무것도 지우지 않았으니 잠시 뒤 다시 시도해 주세요.
                </p>
              )}
            </section>
          </>
        )}

        {/* 로그인 전 · 로그인 못 씀 · 탈퇴 끝에도 화면 모드 · 처리방침은 보인다(이 기기 설정). 로그인했으면 위 '설정'에 있다 */}
        {ready && !(available && signedIn && !withdrawn) && <Settings showNotifications={false} />}
      </main>
      {/* 내 정보 탭의 첫 화면 (BottomTabBar). 상단바 종은 알림함(/notifications)으로 간다(11/20). */}
      <BottomTabBar active="my" />

      {confirming && (
        <Sheet
          title="회원 탈퇴할까요?"
          description="저장된 답과 회원 정보가 모두 지워지고 되돌릴 수 없어요."
          onClose={() => {
            if (!working) setConfirming(false);
          }}
        >
          <Button size="screen" variant="danger" disabled={working} onClick={() => void confirmWithdraw()}>
            {working ? "탈퇴하는 중…" : "탈퇴하기"}
          </Button>
          <Button size="screen" variant="text" data-autofocus disabled={working} onClick={() => setConfirming(false)}>
            취소
          </Button>
        </Sheet>
      )}

      {confirmingLogout && (
        <Sheet
          title="저장 안 된 변경이 있어요"
          description="로그아웃하면 이 기기에서 저장하지 못한 변경이 사라져요. 인터넷 연결을 확인하고 '다시 시도'로 먼저 저장할 수 있어요."
          onClose={() => setConfirmingLogout(false)}
        >
          <Button size="screen" variant="danger" onClick={() => void confirmLogout()}>
            그래도 로그아웃
          </Button>
          <Button size="screen" variant="text" data-autofocus onClick={() => setConfirmingLogout(false)}>
            취소
          </Button>
        </Sheet>
      )}
    </AppShell>
  );
}

/** 설정 — 알림 설정 ›(알림을 쓸 수 있을 때) · 화면 모드 · 개인정보 처리방침 › */
function Settings({ showNotifications }: { showNotifications: boolean }) {
  const row =
    "press focus-ring flex min-h-12 items-center justify-between rounded-control border border-ink-200 bg-surface px-4 py-3 text-sm font-bold text-ink-900";
  return (
    <section aria-label="설정" className="flex flex-col gap-2.5">
      {/* 알림 칸은 알림 설정 화면으로 옮겼다(11/20 두 단계 구조 — 종 → 알림함 → ⚙ 알림 설정). 여기는 길 하나만 */}
      {showNotifications && (
        <Link href="/notifications/settings" className={row}>
          알림 설정
          <ChevronRight size={ICON_MD} aria-hidden="true" className="text-ink-300" />
        </Link>
      )}
      {/* 화면 모드(다크 모드, 11/22) — 로그인과 상관없는 이 기기 설정 */}
      <ThemeSetting />
      <Link href="/privacy" className={row}>
        개인정보 처리방침
        <ChevronRight size={ICON_MD} aria-hidden="true" className="text-ink-300" />
      </Link>
    </section>
  );
}
