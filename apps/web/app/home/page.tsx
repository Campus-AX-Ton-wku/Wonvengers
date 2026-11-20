"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, DeadlineBadge, Icon3D, LinkButton, PerkyCharacter, TopBar } from "@/app/components";
import { ChevronRight, ICON_MD, ICON_SM, Pencil } from "@/app/components/icons";
import { GuideCard } from "@/app/guides/GuideCard";
import { resolveAnswers } from "@/lib/age";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { answerLine } from "@/lib/discovery";
import { homePose, openPolicies, previewPolicies, savedCards, type SavedCard } from "@/lib/home";
import { formatKoreanMoney } from "@/lib/money";
import { deadlineLabel } from "@/lib/preparation";
import { replacePage } from "@/lib/redirect";
import { policiesForRegion } from "@/lib/region";
import { EMPTY_ANSWERS, loadAnswers, loadChecklist, loadDocumentChecks, loadListing, loadProfile, loadSaved, onLocalChange } from "@/lib/storage";
import { GUIDES } from "@/lib/guides";
import { buildCalculationSummary } from "@/lib/summary";
import type { DiscoveryAnswers, PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * 홈 — 내 주거지원 현황 (docs/기획/2026-11-17-홈-찜하기-설계.md "2"). 로그인한 사람만.
 * 순서: 제목 + 내 조건 칩 → 내 지원 요약. 찜한 지원금은 11/20 부터 하단 섬의 '관심' 탭(/saved)이 맡는다.
 * 모양은 2026-11-17 디자인 시안 '홈 · 로그인 직후' · '홈 · 사용 중'을 따른다.
 *
 * 로그인 확인은 처음 열 때 한 번으로 끝나지 않는다. 열어 둔 사이 로그인이 풀리면(갱신 토큰 만료로
 * lib/auth.ts 가 기록을 지움 · 다른 탭에서 로그아웃) 바로 온보딩으로 보낸다 — 로그인 안 한 사람이
 * 홈에 남아 있지 않게.
 */
export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  const [saved, setSaved] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [costs, setCosts] = useState<{ nominal: number; final: number } | null>(null);

  useEffect(() => {
    // 로그인이 풀리면 시작 화면(/start) — 소개 1장부터가 아니라 [내 혜택 찾아보기] · [카카오로 로그인]부터 (11/20)
    const leave = () => replacePage("/start");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    const read = () => {
      const t = seoulTodayISO();
      setToday(t);
      setAnswers(loadAnswers());
      setSaved(loadSaved());
      const listing = loadListing();
      const profile = loadProfile();
      if (listing && profile) {
        try {
          const s = buildCalculationSummary(policiesForRegion(policies, listing.region), profile, listing, t);
          setCosts({ nominal: s.nominalTotalCost, final: s.finalEstimatedHousingCost });
        } catch {
          setCosts(null);
        }
      } else setCosts(null);
      setReady(true);
    };
    read();
    const checkLogin = () => {
      if (!hasStoredLogin()) leave();
    };
    // 다른 탭의 로그아웃은 lib/auth.ts 의 알림이 오지 않는다 — 브라우저의 storage 이벤트로 듣는다.
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_KEY || event.key === null) checkLogin();
    };
    window.addEventListener("storage", onStorage);
    const offAuth = onAuthChange(checkLogin);
    const offLocal = onLocalChange(read);
    return () => {
      window.removeEventListener("storage", onStorage);
      offAuth();
      offLocal();
    };
  }, []);

  if (!ready) return <AppShell><TopBar home /><p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p></AppShell>;

  const open = openPolicies(policies, answers, today);
  const cards = savedCards(policies, saved, today, { checklist: loadChecklist, documents: loadDocumentChecks });

  return (
    <AppShell>
      {/* 왼쪽 위 로고는 링크가 아니다 (TopBar home) — 결과까지 본 사람이 누르면 처음 화면으로 가서 답을 다시 넣게 됐다. */}
      <TopBar home />
      <main className="flex flex-col pb-10 pt-2.5">
        <header className="flex flex-col gap-2.5">
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">내 주거지원 현황</h1>
          {open !== null && <ConditionChip line={answerLine(resolveAnswers(answers, today))} />}
        </header>

        {open === null ? <StartCard /> : <SummaryCard open={open} cards={cards} costs={costs} today={today} />}

        <GuideRow />
      </main>
      <BottomTabBar active="home" />
    </AppShell>
  );
}

/** "25세 · 익산시 · 대학생 [✎ 수정]" — 칩 전체가 조건 수정으로 가는 링크 하나다. */
function ConditionChip({ line }: { line: string }) {
  const parts = line.split(" · ");
  return (
    <Link
      href="/find"
      aria-label={`내 조건 ${line} — 조건 수정`}
      className="focus-ring flex min-h-11 max-w-full items-center gap-2.5 self-start rounded-full bg-surface py-1.5 pl-4 pr-1.5 text-sm font-semibold text-ink-700 shadow-btn-quiet transition-[background-color,translate] duration-100 hover:bg-ink-50 active:translate-y-0.5"
    >
      <span className="min-w-0 truncate">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span aria-hidden="true" className="mx-1.5 text-ink-300">·</span>}
            {part}
          </span>
        ))}
      </span>
      <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 text-[13px] font-bold text-brand-800">
        <Pencil size={ICON_SM - 2} strokeWidth={2.25} aria-hidden="true" />
        수정
      </span>
    </Link>
  );
}

/** 답이 하나도 없을 때(예: 로그인한 채 '처음부터 다시'를 누른 뒤). 결과가 없으니 캐릭터도 두지 않는다. */
function StartCard() {
  return (
    <section aria-label="내 지원 요약" className="mt-6 flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
      <p className="text-base font-bold text-ink-900">질문에 답하면 받을 수 있는 지원금을 찾아 드려요</p>
      <LinkButton href="/find" size="screen" full>시작하기</LinkButton>
    </section>
  );
}

/** Perky 가 카드 위로 몸의 절반쯤 걸터앉는다. 크기 112px — 시안 가이드 '걸치기 112–150px'의 아래 끝. */
const PERCH = "absolute -top-[62px] right-3 w-28";

function SummaryCard({ open, cards, costs, today }: {
  open: PolicyMeta[];
  today: string;
  cards: SavedCard[];
  costs: { nominal: number; final: number } | null;
}) {
  const count = open.length;
  const pose = homePose(count, cards);
  const preview = previewPolicies(open, cards.length);
  const listLabel = preview.length > 0 && count > preview.length ? `${count}건 모두 보기` : "지원금 목록 보기";

  return (
    <section aria-label="내 지원 요약" className="relative mt-[58px] flex flex-col gap-4 rounded-card bg-surface px-5 pb-5 pt-[22px] shadow-card">
      {/* 캐릭터는 상태를 말하는 자리에만, 한 화면에 하나. 같은 뜻을 옆 글자가 늘 함께 말한다(alt=""). */}
      <span data-pose={pose} aria-hidden="true" className={`${PERCH} pointer-events-none`}>
        <PerkyCharacter state={pose} size={112} priority className="h-auto w-28" />
      </span>

      <div className="flex flex-col gap-1 pr-28">
        <p className="text-sm font-semibold text-ink-600">지금 신청할 수 있는 지원금</p>
        <p data-testid="open-count" className="flex items-baseline gap-0.5 text-ink-900">
          <span className="text-[46px] font-extrabold leading-[1.15] tracking-[-0.03em]">{count}</span>
          <span className="text-xl font-bold text-ink-700">건</span>
        </p>
        {pose === "success" && (
          <p className="text-[13px] leading-normal text-ink-600">찜한 지원금 준비를 마쳤어요.</p>
        )}
      </div>

      {preview.length > 0 && (
        <ul aria-label="신청할 수 있는 지원금 미리 보기" className="flex flex-col border-t border-ink-100">
          {preview.map((policy) => (
            <li key={policy.id} className="border-b border-ink-100 last:border-b-0">
              <Link href={`/find/policies/${policy.id}`} className="focus-ring flex min-h-[60px] items-center gap-2.5 rounded-control py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold leading-snug text-ink-900">{policy.name}</span>
                  <span className="text-xs text-ink-500">{policy.agency}</span>
                </span>
                <DeadlineBadge label={deadlineLabel(policy, today)} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <LinkButton href="/find/policies" variant="secondary" size="screen" full>
        {listLabel}
        <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="-ml-1" />
      </LinkButton>

      {costs ? <CostBox costs={costs} /> : <CalculatePrompt />}
    </section>
  );
}

/**
 * 최종 예상 주거비. 금색은 금액에만 쓴다. 막대는 '내가 낼 돈'과 '지원으로 줄어든 돈'의 비율이고,
 * 같은 숫자를 아래 범례가 글자로 말하므로 읽지 않는다(aria-hidden).
 * 디자인은 계속 다듬는 중이다(11/17) — 바뀌면 이 함수만 갈아 끼운다.
 */
function CostBox({ costs }: { costs: { nominal: number; final: number } }) {
  const pay = Math.max(costs.final, 0);
  const cut = Math.max(costs.nominal - pay, 0);
  return (
    <div className="flex flex-col gap-2.5 rounded-control bg-accent-50 px-4 pb-3.5 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-700">최종 예상 주거비</p>
        <Link href="/result" className="focus-ring -my-3 -mr-1.5 flex min-h-11 items-center gap-0.5 rounded-control px-1.5 text-sm font-bold text-brand-700">
          결과 보기
          <ChevronRight size={ICON_SM} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        {/* tabular-nums 를 쓰지 않는다 — 이 한글 폰트에서는 등폭 숫자가 벌어져 '6 42만원'처럼 읽힌다 (PolicyCard). */}
        <span className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-accent-600">{formatKoreanMoney(pay)}</span>
        <span className="text-[13px] font-medium text-ink-500">
          지원 전 <span className="line-through">{formatKoreanMoney(costs.nominal)}</span>
        </span>
      </p>
      {pay + cut > 0 && (
        <div aria-hidden="true" className="flex h-2.5 gap-[3px]">
          {pay > 0 && <span className={`bg-accent-600 ${cut > 0 ? "rounded-l-full rounded-r-[3px]" : "rounded-full"}`} style={{ flex: `${pay} 1 0` }} />}
          {cut > 0 && <span className={`bg-accent-400 ${pay > 0 ? "rounded-l-[3px] rounded-r-full" : "rounded-full"}`} style={{ flex: `${cut} 1 0` }} />}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent-600" />
          {`내가 낼 돈 ${formatKoreanMoney(pay)}`}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent-400 ring-1 ring-inset ring-accent-700/35" />
          {`지원으로 줄어든 돈 ${formatKoreanMoney(cut)}`}
        </span>
      </div>
    </div>
  );
}

/**
 * 계산 전 — 다음 할 일을 상자 하나로. 이 화면의 primary 버튼은 이것 하나다.
 * 그림은 48px 3D 계산기(시안 '3D 아이콘 설계' 5번) — 같은 카드의 Perky(112px)보다 작게 둬서 시선을 뺏지 않는다.
 */
function CalculatePrompt() {
  return (
    <div className="flex flex-col gap-3 rounded-control bg-ink-50 p-4 ring-1 ring-inset ring-ink-100">
      <div className="flex items-center gap-3">
        <Icon3D name="calculator" size={48} />
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-bold leading-normal text-ink-900">보증금·월세를 넣으면 최종 주거비를 계산해요.</p>
        </div>
      </div>
      <LinkButton href="/calculate" size="screen" full>내 월세 계산하기</LinkButton>
    </div>
  );
}

/**
 * 주거 가이드 (11/20) — 요약 아래 가로로 넘기는 카드 3장. 세 번째 카드가 살짝 잘려 보여 옆으로 넘길 수 있다는 걸 말한다.
 * 글은 lib/guides.ts (출처 · 확인일과 함께).
 */
function GuideRow() {
  return (
    <section aria-labelledby="guides-heading" className="mt-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="guides-heading" className="text-lg font-extrabold leading-snug text-ink-900">
          주거 가이드
        </h2>
        <Link
          href="/guides"
          className="focus-ring -mr-1.5 inline-flex min-h-11 items-center gap-0.5 px-1.5 text-sm font-semibold text-ink-600"
        >
          전체 보기
          <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-0.5 [scrollbar-width:none] min-[390px]:-mx-5 min-[390px]:px-5">
        {GUIDES.map((guide) => (
          <li key={guide.id} className="flex">
            <GuideCard guide={guide} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
