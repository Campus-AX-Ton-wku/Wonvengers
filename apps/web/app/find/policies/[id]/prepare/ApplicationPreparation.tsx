"use client";

import { useEffect, useRef, useState } from "react";
import {
  AppShell,
  Button,
  SaveButton,
  ContactInfo,
  ChecklistRow,
  PerkyNote,
  StickyBottomAction,
  TopBar,
  buttonClass,
} from "@/app/components";
import { ICON_SM, ShieldCheck } from "@/app/components/icons";
import { formatDotDate, seoulTodayISO } from "@/lib/date";
import { benefitCeiling, payoutTiming } from "@/lib/benefit";
import { conditionsToConfirm, pageProgress } from "@/lib/preparation";
import {
  EMPTY_CHECKLIST,
  loadChecklist,
  loadDocumentChecks,
  loadProfile,
  saveChecklist,
  saveDocumentChecks,
} from "@/lib/storage";
import { documentIcon } from "@/lib/icons3d";
import type { PolicyMeta } from "@/lib/types";
import type { ChecklistState } from "@/lib/user-data";

type ChecklistKey = keyof ChecklistState;

export default function ApplicationPreparation({ policy }: { policy: PolicyMeta }) {
  const [checklist, setChecklist] = useState<ChecklistState>(EMPTY_CHECKLIST);
  const [checkedDocs, setCheckedDocs] = useState<string[]>([]);
  const [conditions, setConditions] = useState<{ label: string; howToConfirm: string | undefined }[]>([]);
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
    setCheckedDocs(loadDocumentChecks(policy.id));
    setConditions(conditionsToConfirm(policy, loadProfile(), seoulTodayISO()));
    setHydrated(true);
  }, [policy]);

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

  const toggleDoc = (name: string, on: boolean) => {
    // 지금 서류 목록의 이름만, 목록 순서대로 남긴다. 팀이 서류 이름을 바꿔도 옛 이름이 쌓이지 않는다.
    const next = (policy.documents ?? [])
      .map((d) => d.name)
      .filter((n) => (n === name ? on : checkedDocs.includes(n)));
    setCheckedDocs(next);
    saveDocumentChecks(policy.id, next);
  };

  const docs = policy.documents ?? [];
  const applicationPeriod = `${formatDotDate(policy.applicationStart)} ~ ${
    policy.applicationEnd ? formatDotDate(policy.applicationEnd) : "상시"
  }`;
  const progress = pageProgress(policy, checklist, checkedDocs);
  const ceiling = benefitCeiling(policy);
  // 자격 · 기간 확인 줄 — 서류 목록이 있으면 '자격과 기간' 묶음에, 없으면 '준비 서류 확인' 줄 위에 그대로
  const checkRows = (
    <>
      <ChecklistRow
        checked={checklist.eligibility}
        label="자격 조건 확인"
        support={
          conditions.length > 0 ? (
            // 결과 화면이 "신청 준비에서 확인해요"라고 넘긴 조건 — 읽을 수 있는 크기로, 확인 방법과 함께 (11/19)
            <span role="list" className="mt-1 flex flex-col gap-1.5">
              {conditions.map((c) => (
                <span role="listitem" key={c.label} className="block">
                  <span className="block text-[13px] font-medium leading-5 text-ink-800">{c.label}</span>
                  {c.howToConfirm && <span className="block text-xs leading-4 text-ink-500">{c.howToConfirm}</span>}
                </span>
              ))}
            </span>
          ) : undefined
        }
        onChange={(checked) => setChecked("eligibility", checked)}
      />
      <ChecklistRow
        checked={checklist.period}
        label="모집 기간 확인"
        support={applicationPeriod}
        onChange={(checked) => setChecked("period", checked)}
      />
    </>
  );

  return (
    <AppShell>
      <TopBar backHref={`/find/policies/${policy.id}`} />
      {/* 등장 애니메이션은 main 에만 — AppShell 에 걸면 그 안의 상단바(sticky) · 하단 섬(fixed)이 iOS 에서 본문과 같이 스크롤된다 (11/20) */}
      <main className="step-in flex flex-1 flex-col pb-6 pt-1">
        {/* 11/19: 결과 화면에서 [신청 준비]로 넘어와도 어떤 정책인지 이어지게 — 제목이 정책 이름이다
            (예전 '신청 준비' 눈썹 글씨 + '필수 확인 사항을 점검해요'는 어느 정책인지 말하지 않았다) */}
        <header>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-[34px] text-ink-900">{policy.name}</h1>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                {policy.agency}
                {ceiling ? ` · 공고상 ${ceiling.label}` : ""}
                <span className="block text-xs text-ink-500">{payoutTiming(policy)}</span>
              </p>
            </div>
            <SaveButton policyId={policy.id} policyName={policy.name} />
          </div>
        </header>

        <div className="mt-6 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-ink-900">신청 전에 확인해요</h2>
          <p className="shrink-0 text-xs font-medium text-brand-700" role="status" aria-live="polite">
            {hydrated ? `${progress.done} / ${progress.total} 확인` : "저장된 확인 상태 불러오는 중"}
          </p>
        </div>

        {/* 서류 목록이 있으면 두 묶음으로 — 그림 있는 서류 줄과 그림 없는 확인 줄이 한 목록에 섞이면 글자 시작선이
            44px 어긋난다(11/20 교차검증). 묶음마다 줄 모양이 같아 시작선이 맞는다. */}
        <section className={`mt-3 flex flex-col ${docs.length > 0 ? "gap-5" : "gap-2"}`} aria-label="신청 전 확인 목록">
          {docs.length > 0 ? (
            <>
              <ChecklistGroup id="prepare-checks" title="자격과 기간">
                {checkRows}
              </ChecklistGroup>
              <ChecklistGroup id="prepare-documents" title={`챙길 서류 ${docs.length}개`}>
                {docs.map((d) => (
                  <ChecklistRow
                    key={d.name}
                    checked={checkedDocs.includes(d.name)}
                    label={d.name}
                    support={d.note}
                    icon={documentIcon(d.name)}
                    onChange={(checked) => toggleDoc(d.name, checked)}
                  />
                ))}
              </ChecklistGroup>
            </>
          ) : (
            <>
              {checkRows}
              <ChecklistRow
                checked={checklist.documents}
                label="준비 서류 확인"
                support="공식 공고에서 확인해요"
                onChange={(checked) => setChecked("documents", checked)}
              />
            </>
          )}
        </section>

        {/* 끝까지 마친 순간에만 해낸 Perky(success). 하나라도 풀면 사라진다 — 상태를 말하는 자리에만 둔다. */}
        {hydrated && progress.done === progress.total && (
          <PerkyNote
            state="success"
            title="준비를 모두 마쳤어요"
            className="mt-5 rounded-card bg-ok-50 px-4 py-3"
          />
        )}
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

/** 확인 목록의 한 묶음 — 작은 제목 + 줄들. 스크린리더도 묶음 이름을 함께 읽는다. */
function ChecklistGroup({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="px-1 text-[13px] font-bold text-ink-600">
        {title}
      </h3>
      {children}
    </div>
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
        <h2 id="external-handoff-title" className="text-2xl font-extrabold leading-[34px] text-ink-900">
          외부 사이트로 이동할게요
        </h2>
        <p id="external-handoff-description" className="text-sm leading-[22px] text-ink-500">
          Perky는 신청을 대신 접수하지 않아요. 제출은 공식 사이트에서 해 주세요.
        </p>

        <dl className="flex flex-col gap-2.5 rounded-control bg-canvas p-3.5">
          <HandoffRow label="출처" value={policy.agency} />
          <HandoffRow label="최종 확인" value={policy.verifiedAt ? formatDotDate(policy.verifiedAt) : "제공 정보 없음"} />
        </dl>
        <ContactInfo contact={policy.contact} variant="inline" />

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
