"use client";

import { useEffect, useRef, useState } from "react";
import {
  AppShell,
  Button,
  StickyBottomAction,
  TopBar,
  buttonClass,
} from "@/app/components";
import { Check, ICON_SM, ShieldCheck } from "@/app/components/icons";
import { formatDotDate } from "@/lib/date";
import type { PolicyMeta } from "@/lib/types";

type ChecklistKey = "eligibility" | "period" | "documents";
type ChecklistState = Record<ChecklistKey, boolean>;

const EMPTY_CHECKLIST: ChecklistState = {
  eligibility: false,
  period: false,
  documents: false,
};

function storageKey(policyId: string) {
  return `perky.application-checklist:${policyId}`;
}

function loadChecklist(policyId: string): ChecklistState {
  if (typeof window === "undefined") return EMPTY_CHECKLIST;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(policyId)) ?? "null") as Partial<ChecklistState> | null;
    return {
      eligibility: saved?.eligibility === true,
      period: saved?.period === true,
      documents: saved?.documents === true,
    };
  } catch {
    return EMPTY_CHECKLIST;
  }
}

function saveChecklist(policyId: string, checklist: ChecklistState) {
  try {
    window.localStorage.setItem(storageKey(policyId), JSON.stringify(checklist));
  } catch {
    // 저장이 제한된 환경에서도 체크와 외부 이동은 계속 쓸 수 있어야 한다.
  }
}

export default function ApplicationPreparation({ policy }: { policy: PolicyMeta }) {
  const [checklist, setChecklist] = useState<ChecklistState>(EMPTY_CHECKLIST);
  const [hydrated, setHydrated] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const confirmLinkRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(false);

  const closeHandoff = () => {
    restoreFocusRef.current = true;
    setHandoffOpen(false);
  };

  useEffect(() => {
    setChecklist(loadChecklist(policy.id));
    setHydrated(true);
  }, [policy.id]);

  useEffect(() => {
    if (!handoffOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      document.getElementById("open-application-handoff")?.focus();
    }
  }, [handoffOpen]);

  useEffect(() => {
    if (!handoffOpen) return;
    confirmLinkRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHandoff();
        return;
      }
      if (event.key === "Tab") {
        const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handoffOpen]);

  const setChecked = (key: ChecklistKey, checked: boolean) => {
    const next = { ...checklist, [key]: checked };
    setChecklist(next);
    saveChecklist(policy.id, next);
  };

  const applicationPeriod = `${formatDotDate(policy.applicationStart)} ~ ${
    policy.applicationEnd ? formatDotDate(policy.applicationEnd) : "상시"
  }`;
  const completedCount = Object.values(checklist).filter(Boolean).length;

  return (
    <AppShell className="step-in">
      <TopBar backHref={`/find/policies/${policy.id}`} backLabel="혜택 상세로 돌아가기" />
      <main className="flex flex-1 flex-col pb-6 pt-1">
        <header>
          <p className="text-[11px] font-bold leading-4 text-ink-500">신청 준비</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-[34px] text-ink-900">
            필수 확인 사항을 점검해요
          </h1>
          <p className="mt-1 text-sm leading-[22px] text-ink-500">
            확인한 항목은 이 기기에 저장되어 언제든 이어서 볼 수 있어요.
          </p>
          <p className="mt-2 text-xs font-medium text-brand-700" role="status" aria-live="polite">
            {hydrated ? `${completedCount} / 3 확인` : "저장된 확인 상태 불러오는 중"}
          </p>
        </header>

        <section className="mt-5 flex flex-col gap-2" aria-label="신청 전 확인 목록">
          <ChecklistRow
            checked={checklist.eligibility}
            label="자격 조건 확인"
            support="내 정보와 공고의 지원 대상을 다시 대조해요"
            onChange={(checked) => setChecked("eligibility", checked)}
          />
          <ChecklistRow
            checked={checklist.period}
            label="모집 기간 확인"
            support={applicationPeriod}
            onChange={(checked) => setChecked("period", checked)}
          />
          <ChecklistRow
            checked={checklist.documents}
            label="준비 서류 확인"
            support="서류 종류와 발급일은 공식 공고에서 확인해요"
            onChange={(checked) => setChecked("documents", checked)}
          />
        </section>

        <section className="mt-5 rounded-control bg-accent-50 px-4 py-3.5" aria-labelledby="official-notice-title">
          <h2 id="official-notice-title" className="text-sm font-bold leading-[22px] text-ink-900">
            제출 전 다시 확인해 주세요
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-ink-500">
            현재 정책 데이터에는 준비 서류 목록이 제공되지 않습니다. 필요 서류와 발급일 기준은 공식 공고에서 확인해 주세요.
          </p>
        </section>

        <p className="mt-4 text-[11px] leading-4 text-ink-500">
          신청 위치 · {policy.agency} 공식 사이트 · 외부 이동 전 안내 제공
        </p>
      </main>

      <StickyBottomAction>
        <Button id="open-application-handoff" size="screen" onClick={() => setHandoffOpen(true)}>
          공식 신청 사이트로 이동
        </Button>
      </StickyBottomAction>

      {handoffOpen && (
        <ExternalApplicationHandoff
          policy={policy}
          dialogRef={dialogRef}
          confirmLinkRef={confirmLinkRef}
          onClose={closeHandoff}
        />
      )}
    </AppShell>
  );
}

function ChecklistRow({
  checked,
  label,
  support,
  onChange,
}: {
  checked: boolean;
  label: string;
  support: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="focus-within:ring-brand-500 flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-200 bg-surface px-4 py-3.5 focus-within:ring-2 focus-within:ring-offset-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-[22px] text-ink-900">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-ink-500">{support}</span>
      </span>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-xs font-medium ${
          checked ? "bg-ok-50 text-ok-700" : "bg-ink-100 text-ink-600"
        }`}
        aria-hidden="true"
      >
        {checked && <Check size={ICON_SM - 2} strokeWidth={2.5} />}
        {checked ? "확인함" : "확인 전"}
      </span>
    </label>
  );
}

function ExternalApplicationHandoff({
  policy,
  dialogRef,
  confirmLinkRef,
  onClose,
}: {
  policy: PolicyMeta;
  dialogRef: React.RefObject<HTMLElement | null>;
  confirmLinkRef: React.RefObject<HTMLAnchorElement | null>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 min-[390px]:px-5 sm:items-center">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-handoff-title"
        aria-describedby="external-handoff-description"
        className="flex max-h-full w-full max-w-[350px] flex-col gap-4 overflow-y-auto rounded-card border border-ink-200 bg-surface p-6 shadow-card"
      >
        <p className="w-fit rounded-[10px] bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700">
          공식 신청 사이트
        </p>
        <h2 id="external-handoff-title" className="text-2xl font-extrabold leading-[34px] text-ink-900">
          외부 사이트로 이동할게요
        </h2>
        <p id="external-handoff-description" className="text-sm leading-[22px] text-ink-500">
          Perky는 신청을 대신 접수하지 않아요. 공식 사이트에서 입력 내용을 다시 확인하고 제출해 주세요.
        </p>

        <dl className="flex flex-col gap-2.5 rounded-control bg-canvas p-3.5">
          <HandoffRow label="출처" value={policy.agency} />
          <HandoffRow label="최종 확인" value={policy.verifiedAt ? formatDotDate(policy.verifiedAt) : "제공 정보 없음"} />
        </dl>

        <p className="rounded-control bg-brand-50 px-3 py-2.5 text-[11px] leading-4 text-brand-700">
          사이트 주소와 운영기관을 확인한 뒤 개인정보를 입력해 주세요.
        </p>

        <div className="mt-2 flex flex-col gap-2">
          <a
            ref={confirmLinkRef}
            href={policy.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ size: "screen" })}
          >
            <ShieldCheck size={ICON_SM} aria-hidden="true" />
            공식 사이트로 이동
          </a>
          <Button size="screen" variant="secondary" onClick={onClose}>취소</Button>
        </div>
      </section>
    </div>
  );
}

function HandoffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-4">
      <dt className="text-[11px] leading-4 text-ink-500">{label}</dt>
      <dd className="text-right text-xs font-medium leading-[18px] text-ink-900">{value}</dd>
    </div>
  );
}
