"use client";

import {
  AppShell,
  Button,
  LinkButton,
  PerkyCharacter,
  TopBar,
} from "@/app/components";
import { formatDotDate } from "@/lib/date";

type LoadingContext = "initial" | "recalculate" | "more";

const LOADING_COPY: Record<LoadingContext, { eyebrow: string; title: string; status: string }> = {
  initial: {
    eyebrow: "맞춤 혜택 계산",
    title: "맞는 혜택을 찾고 있어요",
    status: "입력한 조건으로 계산 중이에요.",
  },
  recalculate: {
    eyebrow: "맞춤 혜택 재계산",
    title: "변경한 조건을 반영하고 있어요",
    status: "입력한 정보는 그대로 유지돼요.",
  },
  more: {
    eyebrow: "맞춤 혜택 결과",
    title: "혜택을 더 불러오고 있어요",
    status: "현재 결과는 그대로 볼 수 있어요.",
  },
};

function ResultHeader({
  eyebrow,
  title,
  support,
}: {
  eyebrow: string;
  title: string;
  support: string;
}) {
  return (
    <header>
      <p className="text-[11px] font-bold leading-4 text-ink-500">{eyebrow}</p>
      <h1 className="mt-0.5 text-2xl font-extrabold leading-[34px] text-ink-900">{title}</h1>
      <p className="mt-0.5 text-sm leading-[22px] text-brand-700">{support}</p>
    </header>
  );
}

/** 실제 값처럼 보이는 숫자 없이 카드의 정보 구조만 예고한다. */
export function ResultLoading({ context = "initial" }: { context?: LoadingContext }) {
  const copy = LOADING_COPY[context];

  return (
    <AppShell>
      <TopBar backHref="/eligibility" backLabel="조건 입력으로 돌아가기" />
      <main className="flex flex-1 flex-col pb-8 pt-1" aria-busy="true">
        <ResultHeader eyebrow={copy.eyebrow} title={copy.title} support={copy.status} />

        <section className="mt-5" aria-labelledby="result-loading-status">
          <p
            id="result-loading-status"
            className="text-sm font-bold leading-[22px] text-ink-900"
            role="status"
            aria-live="polite"
          >
            {context === "initial"
              ? "혜택 계산 중"
              : context === "recalculate"
                ? "변경한 조건 반영 중"
                : "혜택 더 불러오는 중"}
          </p>
          <div
            className="motion-safe:animate-pulse mt-3 flex h-[382px] flex-col gap-[18px] overflow-hidden rounded-card bg-surface p-6 shadow-card"
            aria-hidden="true"
          >
            <span className="h-6 w-[92px] shrink-0 rounded-full bg-ink-100" />
            <span className="h-6 w-4/5 shrink-0 rounded-control bg-ink-100" />
            <span className="h-4 w-1/2 shrink-0 rounded-control bg-ink-100" />
            <span className="flex h-[92px] shrink-0 flex-col gap-2.5 rounded-control bg-surface p-4 ring-1 ring-ink-100">
              <span className="h-3 w-2/5 rounded-control bg-ink-100" />
              <span className="h-7 w-2/3 rounded-control bg-ink-100" />
            </span>
            <span className="h-px shrink-0 bg-brand-100" />
            <span className="flex h-[42px] shrink-0 items-center justify-between">
              <span className="h-4 w-2/3 rounded-control bg-ink-100" />
              <span className="h-6 w-6 rounded-full bg-ink-100" />
            </span>
            <span className="h-12 shrink-0 rounded-control bg-ink-100" />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

type ResultStateKind = "empty" | "error" | "expired";

const STATE_COPY = {
  empty: {
    character: "empty" as const,
    eyebrow: "맞춤 혜택 결과",
    headline: "조건을 조금 바꿔볼까요?",
    support: "내 정보는 그대로 저장되어 있어요.",
    title: "조건에 맞는 혜택을 찾지 못했어요",
    description: "거주 지역이나 입력한 조건을 바꾸면 결과가 달라질 수 있어요.",
  },
  error: {
    character: "thinking" as const,
    eyebrow: "연결 상태 확인",
    headline: "결과를 불러오지 못했어요",
    support: "잠시 후 같은 조건으로 다시 시도해 주세요.",
    title: "혜택을 불러오지 못했어요",
    description: "잠시 후 다시 시도해 주세요. 입력한 내용은 그대로 보관되어 있어요.",
  },
  expired: {
    character: "basic" as const,
    eyebrow: "혜택 모집 상태",
    headline: "모집이 종료된 혜택이에요",
    support: "신청 가능한 다른 혜택을 이어서 확인하세요.",
    title: "이번 모집은 종료됐어요",
    description: "지금 신청할 수 있는 다른 혜택을 이어서 확인해 보세요.",
  },
};

export function ResultState({
  kind,
  endDate = null,
  onRetry,
}: {
  kind: ResultStateKind;
  endDate?: string | null;
  onRetry?: () => void;
}) {
  const content = STATE_COPY[kind];

  return (
    <AppShell>
      <TopBar backHref="/eligibility" backLabel="조건 입력으로 돌아가기" />
      <main className="flex flex-1 flex-col pb-8 pt-1">
        <ResultHeader eyebrow={content.eyebrow} title={content.headline} support={content.support} />

        <section
          className="mt-5 flex min-h-[574px] flex-1 flex-col items-center rounded-card bg-surface px-6 pb-6 pt-7 text-center shadow-card"
          aria-labelledby={`result-${kind}-title`}
        >
          <PerkyCharacter
            state={content.character}
            size={160}
            className="h-40 w-40 shrink-0 object-contain"
            priority
          />

          {kind === "expired" && (
            <p className="mt-4 rounded-full bg-ink-100 px-2.5 py-1.5 text-xs font-medium text-ink-600">
              모집 종료
            </p>
          )}

          <h2 id={`result-${kind}-title`} className="mt-4 text-sm font-bold leading-[22px] text-ink-900">
            {content.title}
          </h2>
          <p className="mt-3 text-sm leading-[22px] text-ink-500">{content.description}</p>

          {kind === "expired" && (
            <p className="mt-3 text-xs font-medium leading-[18px] text-ink-600">
              {endDate ? `종료일 · ${formatDotDate(endDate)}` : "종료일 정보 없음"}
            </p>
          )}

          <div className="mt-auto flex w-full flex-col gap-2 pt-6">
            {kind === "empty" && (
              <>
                <LinkButton href="/eligibility" size="screen">내 정보 수정하기</LinkButton>
                <LinkButton href="/find/policies" variant="secondary" size="screen">
                  전체 혜택 둘러보기
                </LinkButton>
              </>
            )}
            {kind === "error" && (
              <>
                <Button size="screen" onClick={onRetry ?? (() => window.location.reload())}>
                  다시 시도하기
                </Button>
                <LinkButton href="/find/policies" variant="secondary" size="screen">혜택 홈으로</LinkButton>
              </>
            )}
            {kind === "expired" && (
              <>
                <LinkButton href="/find/policies" size="screen">신청 가능한 혜택 보기</LinkButton>
                <LinkButton href="/eligibility" variant="secondary" size="screen">조건 다시 확인하기</LinkButton>
              </>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
