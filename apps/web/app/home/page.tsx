"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, BottomTabBar, LinkButton, PerkyCharacter, PushAskSheet, TopBar } from "@/app/components";
import { ArrowRight, ChevronRight, ICON_MD, ICON_SM, TrendingDown } from "@/app/components/icons";
import { GuideCard } from "@/app/guides/GuideCard";
import { ScheduleCard } from "./ScheduleCard";
import { TodayCard } from "./TodayCard";
import { LedgerRow } from "./LedgerRow";
import { LoanRow } from "./LoanRow";
import { NoticeRow } from "./NoticeRow";
import { todayTodo, todoPolicyId, upcomingSchedule } from "@/lib/home-today";
import { AUTH_KEY, hasStoredLogin, isLoginAvailable, onAuthChange, storedSub } from "@/lib/auth";
import { seoulTodayISO } from "@/lib/date";
import { homePose, openPolicies, savedCards, type SavedCard } from "@/lib/home";
import { ledgerMonth, ledgerPlan, ledgerProgress, monthKeyOf, type LedgerProgress } from "@/lib/ledger";
import { formatApproxMoney } from "@/lib/money";
import { markPushAsked, pushAskFor, type PushAskKind } from "@/lib/push-ask";
import { replacePage } from "@/lib/redirect";
import { EMPTY_ANSWERS, loadAnswers, markHomeReached, loadChecklist, loadDocumentChecks, loadLedger, loadListing, loadProfile, loadProfileCard, loadSaved, loadApplied, onLocalChange } from "@/lib/storage";
import { guidesForHousing } from "@/lib/guides";
import { HOUSE_CHECKLIST_CARD } from "@/lib/house-checklist";
import { calcMonths } from "@/lib/rent";
import { buildCalculationSummary } from "@/lib/summary";
import type { DiscoveryAnswers, HousingType, PolicyMeta } from "@/lib/types";
import type { ProfileCardData } from "@/lib/user-data";
import { HomeGreeting } from "./HomeGreeting";
import { notApplied, notAppliedIds } from "@/lib/applied";
import { calculationScope } from "@/lib/scope";

const policies = policiesJson as PolicyMeta[];

/** 마지막 계산의 주거비 — 지원 전(명목) · 지원 후(최종) · 센 개월 수 */
type Costs = { nominal: number; final: number; months: number };

/**
 * 홈 — 내 주거지원 현황 (docs/기획/2026-11-17-홈-찜하기-설계.md "2"). 로그인한 사람만.
 * 순서: 제목 + 내 조건 칩 → 오늘 할 일 → 내 지원 요약 → 다가오는 일정 → 대출 · 보증(11/22) → 주거 가이드 (11/20 홈 보강, docs/기획/2026-11-20-홈-보강-설계.md).
 * 주거비 상자 아래 주거비 달력 입구 한 줄(11/21).
 * 관심 지원금 목록은 11/20 부터 하단 섬의 '관심' 탭(/saved)이 맡는다.
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
  const [applied, setAppliedIds] = useState<Record<string, string>>({});
  const [profileCard, setProfileCard] = useState<ProfileCardData | null>(null);
  const [today, setToday] = useState("");
  const [costs, setCosts] = useState<Costs | null>(null);
  const [ledger, setLedger] = useState<LedgerProgress | null>(null);
  const [pushAsk, setPushAsk] = useState<PushAskKind | null>(null);

  useEffect(() => {
    // 로그인이 풀리면 시작 화면(/start) — 소개 1장부터가 아니라 [내 혜택 찾아보기] · [카카오로 로그인]부터 (11/20)
    const leave = () => replacePage("/start");
    if (!isLoginAvailable() || !hasStoredLogin()) {
      leave();
      return;
    }
    // 로그인하고 홈까지 왔다 — 배지 알림은 여기서부터 (BadgeWatcher, 11/23 ggue).
    // 알림 허용을 물을 차례면(lib/push-ask.ts) 그 창을 먼저 띄우고, 닫은 뒤에 배지를 판정한다 — 창 두 개가 겹치지 않게.
    let alive = true;
    const sub = storedSub();
    void pushAskFor("home")
      .catch(() => null)
      .then((kind) => {
        if (!alive) return;
        if (kind) {
          markPushAsked("home");
          setPushAsk(kind);
        } else if (sub) {
          markHomeReached(sub);
        }
      });
    const read = () => {
      const t = seoulTodayISO();
      setToday(t);
      setAnswers(loadAnswers());
      setSaved(loadSaved());
      setAppliedIds(loadApplied());
      setProfileCard(loadProfileCard());
      const listing = loadListing();
      const profile = loadProfile();
      if (listing && profile) {
        try {
          const s = buildCalculationSummary(calculationScope(policies, listing, loadAnswers(), t), profile, listing, t);
          // 기간은 lib/rent.ts calcMonths — 주거비 · 지원금과 같은 기간(입력한 거주 개월 수)
          setCosts({ nominal: s.nominalTotalCost, final: s.finalEstimatedHousingCost, months: calcMonths(listing) });
          // 주거비 달력 입구 한 줄 — 달력 화면과 같은 함수로 센다 (lib/ledger.ts)
          setLedger(ledgerProgress(ledgerMonth(ledgerPlan(listing, s, profile.birthDate), loadLedger(), monthKeyOf(t))));
        } catch {
          setCosts(null);
          setLedger(null);
        }
      } else {
        setCosts(null);
        setLedger(null);
      }
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
      alive = false;
      window.removeEventListener("storage", onStorage);
      offAuth();
      offLocal();
    };
  }, []);

  const closePushAsk = () => {
    setPushAsk(null);
    const sub = storedSub();
    if (sub) markHomeReached(sub);
  };

  if (!ready) return <AppShell><TopBar home /><p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p></AppShell>;

  // 신청 완료로 표시한 지원금은 홈의 추천 · 관심 미리보기 · 할 일 · 일정에서 뺀다(11/23 ggue, lib/applied.ts)
  const shown = notApplied(policies, applied);
  const savedOpen = notAppliedIds(saved, applied);
  const open = openPolicies(shown, answers, today);
  const cards = savedCards(shown, savedOpen, today, { checklist: loadChecklist, documents: loadDocumentChecks });
  const read = { checklist: loadChecklist, documents: loadDocumentChecks };
  // 답 전(시작하기 카드)에는 할 일을 두지 않는다 — '시작하기'가 그 사람의 할 일 하나다
  const todo = open === null ? null : todayTodo(shown, answers, savedOpen, today, read, costs !== null);
  // 오늘 할 일에 오른 정책은 일정에서 뺀다 — 같은 지원금이 한 화면에 두 번 나오지 않게(11/20)
  const schedule = upcomingSchedule(shown, savedOpen, today, todoPolicyId(todo?.item ?? null));

  return (
    <AppShell>
      {/* 왼쪽 위 로고는 링크가 아니다 (TopBar home) — 결과까지 본 사람이 누르면 처음 화면으로 가서 답을 다시 넣게 됐다. */}
      <TopBar home />
      <main className="flex flex-col pb-10 pt-2.5">
        <header className="flex flex-col gap-2.5">
          {/* 홈 인사(11/22 내 프로필) — 제목 위, 누르면 내 정보. 계산 전 · 후 같은 머리 */}
          <HomeGreeting card={profileCard} answers={answers} />
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">내 주거지원 현황</h1>
        </header>

        {todo?.item && <TodayCard item={todo.item} more={todo.more} />}

        {open === null ? <StartCard /> : <SummaryCard open={open} cards={cards} costs={costs} ledger={ledger} hasTodo={Boolean(todo?.item)} />}

        {/* 일정이 없으면 블록째 숨긴다 (11/20 ggue) */}
        {schedule.length > 0 && <ScheduleCard events={schedule} today={today} />}

        <NoticeRow today={today} />
        {/* 주거 가이드 → 대출 · 보증 순서 (11/22 ggue) */}
        <GuideRow housingType={answers.housingType} />
        <LoanRow region={answers.region} housingType={answers.housingType} />
      </main>
      <BottomTabBar active="home" />
      {pushAsk && <PushAskSheet kind={pushAsk} onClose={closePushAsk} />}
    </AppShell>
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

/**
 * 내 지원 요약 (시안 '홈 보강', 11/21 조정).
 * - Perky 는 카드 **안** 오른쪽 위(100px 칸, 높이 96px) + 발밑 옅은 타원 그림자. 예전엔 카드 위로 걸터앉았다(-62px)
 * - 지금 신청할 수 있는 지원금은 미리 보기 줄 없이 [지원금 목록 보기] 버튼 하나 — 지원금 화면으로 간다(ggue 11/21)
 */
function SummaryCard({ open, cards, costs, ledger, hasTodo }: {
  open: PolicyMeta[];
  cards: SavedCard[];
  costs: Costs | null;
  ledger: LedgerProgress | null;
  /** 위에 오늘 할 일 카드가 있으면 간격을 좁힌다(시안 16 / 24px) */
  hasTodo: boolean;
}) {
  const count = open.length;
  const pose = homePose(count, cards);

  return (
    <section
      aria-label="내 지원 요약"
      className={`relative flex flex-col gap-4 rounded-card bg-surface px-5 pb-5 pt-[22px] shadow-card ${hasTodo ? "mt-4" : "mt-6"}`}
    >
      {/* 캐릭터는 상태를 말하는 자리에만, 한 화면에 하나. 같은 뜻을 옆 글자가 늘 함께 말한다(alt=""). */}
      <span
        data-perky-spot
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-3 flex size-[100px] items-end justify-center"
      >
        <span
          data-perky-shadow
          className="absolute -bottom-[5px] left-1/2 -ml-[33px] h-3 w-[66px] rounded-[50%]"
          style={{ background: "radial-gradient(closest-side, var(--color-floor), transparent)" }}
        />
        <PerkyCharacter state={pose} size={192} priority className="relative h-24 w-auto" />
      </span>

      <div className="flex min-h-[100px] flex-col gap-1 pr-28">
        <p className="text-sm font-semibold text-ink-600">지금 신청할 수 있는 지원금</p>
        <p data-testid="open-count" className="flex items-baseline gap-0.5 text-ink-900">
          <span className="text-[46px] font-extrabold leading-[1.15] tracking-[-0.03em]">{count}</span>
          <span className="text-xl font-bold text-ink-700">건</span>
        </p>
        {pose === "success" && (
          <p className="text-[13px] leading-normal text-ink-600">관심 지원금 준비를 마쳤어요.</p>
        )}
      </div>

      {/* 목록은 지원금 화면(/find/policies)이 맡는다 — 홈에서 펼치지 않는다(ggue 11/21: 토글 → 페이지 이동) */}
      <LinkButton href="/find/policies" variant="secondary" size="screen" full>
        지원금 목록 보기
        <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="-ml-1" />
      </LinkButton>

      {costs && <CostBox costs={costs} showCut={count > 0} />}

      {costs && ledger && <LedgerRow progress={ledger} />}
    </section>
  );
}

/**
 * 최종 예상 주거비 (시안 '홈 · 사용 중', 11/20 · 11/21 조정). 상자 전체가 결과로 가는 링크 하나라 읽는 이름에 요약을 다 담는다.
 * 지원 전 → 지원 후, 그리고 줄어든 돈 한 줄. 금액 색은 남색이다(11/20 금색 → 남색, ggue).
 * - 금액은 천 원 단위(formatApproxMoney — 바뀌면 '약'). 연세를 월로 나눈 '159만 9,996원'이 숫자 한가운데서 꺾였다(11/21).
 *   정확한 값은 결과 화면에 있다. 금액 덩어리는 줄바꿈하지 않고, 정말 좁으면 '지원 후'가 통째로 아랫줄로 간다
 * - 지원 전 · 후가 같으면(금액에 넣은 지원 없음) 같은 숫자를 화살표로 잇지 않고 금액 하나 + "아직 금액에 넣은 지원이 없어요"
 * - 줄어든 돈은 지금 신청할 수 있는 게 있을 때만 — 0건인데 "○○만원 줄었어요"가 나오면 서로 맞지 않는다(11/20 시안 검토)
 * tabular-nums 를 쓰지 않는다 — 이 한글 폰트에서는 등폭 숫자가 벌어져 '6 42만원'처럼 읽힌다 (PolicyCard).
 */
function CostBox({ costs, showCut }: { costs: Costs; showCut: boolean }) {
  const after = Math.max(costs.final, 0);
  const cut = Math.max(costs.nominal - after, 0);
  const beforeText = formatApproxMoney(costs.nominal);
  const afterText = formatApproxMoney(after);
  const noSupport = cut === 0;
  const label = noSupport
    ? `최종 예상 주거비, ${costs.months}개월 기준, ${afterText}. 아직 금액에 넣은 지원이 없어요. 결과 보기`
    : `최종 예상 주거비, ${costs.months}개월 기준. 지원 전 ${beforeText}, 지원 후 ${afterText}. 결과 보기`;
  return (
    <Link
      href="/result"
      aria-label={label}
      className="focus-ring flex flex-col gap-3.5 rounded-control bg-brand-50 px-4 pb-3.5 pt-4 transition-colors hover:bg-brand-100"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ink-700">최종 예상 주거비</span>
          <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-surface px-2 text-xs font-bold text-ink-600">
            {costs.months}개월 기준
          </span>
        </span>
        <ChevronRight size={ICON_MD} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-ink-500" />
      </span>
      {noSupport ? (
        <span className="flex flex-col gap-1">
          <span className="whitespace-nowrap text-2xl font-extrabold leading-tight tracking-[-0.02em] text-brand-900">{afterText}</span>
          <span className="text-sm text-ink-600">아직 금액에 넣은 지원이 없어요</span>
        </span>
      ) : (
        <span className="flex flex-wrap items-end gap-x-2.5 gap-y-2">
          <span className="flex items-end gap-2.5">
            <span className="flex flex-col gap-0.5 pb-[3px]">
              <span className="text-xs font-semibold text-ink-600">지원 전</span>
              <span className="whitespace-nowrap text-[17px] font-bold text-ink-600">{beforeText}</span>
            </span>
            <span aria-hidden="true" className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-brand-800 shadow-[0_2px_6px_-2px_rgba(11,42,74,0.22)]">
              <ArrowRight size={ICON_SM} strokeWidth={2.5} />
            </span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-brand-800">지원 후</span>
            <span className="whitespace-nowrap text-2xl font-extrabold leading-tight tracking-[-0.02em] text-brand-900">{afterText}</span>
          </span>
        </span>
      )}
      {showCut && !noSupport && (
        <>
          <span aria-hidden="true" className="h-px bg-brand-600/15" />
          <span className="-mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <TrendingDown size={ICON_SM} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-brand-800" />
            <span>
              <strong className="whitespace-nowrap font-extrabold text-brand-800">{formatApproxMoney(cut)}</strong> 줄었어요
            </span>
          </span>
        </>
      )}
    </Link>
  );
}

/**
 * 주거 가이드 (11/20) — 요약 아래 가로로 넘기는 카드 3장 + 맨 끝 집 보러 갈 때 체크리스트(11/22). 세 번째 카드가 살짝 잘려 보여 옆으로 넘길 수 있다는 걸 말한다.
 * 글은 lib/guides.ts (출처 · 확인일과 함께). 첫 카드는 집 형태 답으로 고른다(guidesForHousing, 11/20).
 */
function GuideRow({ housingType }: { housingType: HousingType | null }) {
  const { guides, tag } = guidesForHousing(housingType);
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
        {guides.map((guide, i) => (
          <li key={guide.id} className="flex">
            <GuideCard guide={guide} compact tag={i === 0 ? tag : null} />
          </li>
        ))}
        {/* 집 보러 갈 때 체크리스트(11/22) — 맨 끝. '○○라면 먼저' 첫 카드 규칙은 그대로 둔다 */}
        <li className="flex">
          <GuideCard guide={HOUSE_CHECKLIST_CARD} compact />
        </li>
      </ul>
    </section>
  );
}
