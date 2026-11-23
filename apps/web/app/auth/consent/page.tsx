"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Icon3D, StickyBottomAction, SyncConflictSheet, TopBar, buttonClass } from "@/app/components";
import { ChevronDown, ChevronRight, ICON_SM, TriangleAlert } from "@/app/components/icons";
import { consumeReturnTo, isLoginAvailable, recordConsent, storedSub } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { initialSync, logout } from "@/lib/sync";

/**
 * 저장하는 것. 소득·재산·수급 여부가 들어가는(들어갈 수 있는) 줄은 '민감할 수 있는 답'으로 따로 묶는다(설계 '화면' 3).
 * 첫 질문의 월 소득 구간도 소득이라 따로 줄을 나눈다.
 * 11/23 시안(저장 동의 · 다듬은 안): 첫 화면엔 종류 한 문장 + 민감한 답 한 줄만, 이 목록은 [n가지 하나씩 보기]로 펼친다.
 * 줄을 빼거나 더할 때는 SUMMARY 문장도 같이 고친다.
 */
const STORED_ITEMS: { name: string; detail: string; sensitive?: boolean }[] = [
  { name: "첫 질문의 답", detail: "생년월일 · 사는 곳 · 현재 상태 · 주거 형태" },
  { name: "월 소득 구간", detail: "첫 질문에서 고른 월 소득 구간", sensitive: true },
  { name: "계약 조건", detail: "지역 · 계약 형태 · 보증금 · 월세 · 관리비 · 이사 비용 · 계약 시작일 · 거주 개월 수" },
  {
    name: "자격 질문의 답",
    detail: "가구원 수 · 본인과 부모 가구 소득 · 재산 기준 충족 여부 · 기초생활수급 · 차상위 여부 · 무주택 여부 등",
    sensitive: true,
  },
  {
    name: "결과 화면에서 답한 조건",
    detail: "정책마다 직접 답한 '확인 필요' 조건 — 소득 · 재산 · 수급 여부가 들어갈 수 있어요",
    sensitive: true,
  },
  { name: "신청 체크리스트", detail: "정책마다 확인 표시한 항목" },
  { name: "관심 지원금", detail: "하트로 모아 둔 지원금과 정책별 서류 준비 체크" },
  // 11/22 내 프로필 — 동의 버전은 올리지 않는다(11/17 관심 지원금 줄과 같게, 설계 §1)
  { name: "프로필 · 배지", detail: "꾸민 그림 · 색 · 이름 · 대표 배지, 받은 배지와 받은 날" },
  // 11/23 주거비 달력 · 집 보기 체크리스트 계정 저장 — 동의 버전은 올리지 않는다(프로필 · 배지 줄과 같게)
  { name: "주거비 달력 · 집 보기 체크리스트", detail: "달마다 낸 돈 · 받은 지원을 누른 표시와 고친 금액, 집 보기 체크리스트에서 확인한 항목" },
];

const BASIC_ITEMS = STORED_ITEMS.filter((item) => !item.sensitive);
const SENSITIVE_ITEMS = STORED_ITEMS.filter((item) => item.sensitive);

/** 저장하는 종류를 한 문장으로 — 민감한 답은 아래 주황 한 줄이 따로 말한다. */
const SUMMARY = "질문에 고른 답, 계약 조건, 신청 체크리스트, 관심 지원금, 프로필 · 배지, 주거비 달력 · 집 보기 체크리스트";

/** 회색 상자의 개발 용어(Amazon Cognito · 리전)는 쉬운 말로 (11/23 시안). */
const NOTES = [
  "서버는 대한민국 서울(AWS)에 있어요.",
  "카카오 회원번호는 로그인 서비스에만 남고, 저장한 답에는 무작위 번호만 붙어요.",
  "지우고 싶으면 '처음부터 다시'로 답을 비우거나, 내 정보 › 회원 탈퇴로 전부 지워요.",
];

/**
 * 저장 동의 (설계 '화면' 3). 동의하기 전에는 서버로 아무것도 보내지 않는다 — 이 화면은 서버를 부르지 않고,
 * [동의하고 저장]을 누른 뒤에야 initialSync 가 처음으로 부른다.
 * [동의하지 않음]은 즉시 로그아웃이다 — lib/sync.ts 의 logout() 과 같은 규칙으로. 로그인 전에 고른 답은
 * 서버에 간 적이 없으니 그대로 두고, 예전 문구에 동의해 서버와 맞췄던 사람(새 문구를 거절)이면 서버에서 온
 * 사본을 지운다(공용 PC). 지금 문구 동의가 없으니 logout() 은 서버를 부르지 않는다.
 */
export default function ConsentPage() {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ok = isLoginAvailable();
    setAvailable(ok);
    setSub(ok ? storedSub() : null);
    setReady(true);
  }, []);

  async function agree() {
    if (sub === null) return;
    setWorking(true);
    recordConsent(sub);
    try {
      if ((await initialSync()) === "conflict") {
        setConflict(true);
        setWorking(false);
        return;
      }
    } catch {
      setFailed(true);
      setWorking(false);
      return;
    }
    replacePage(consumeReturnTo());
  }

  const header = <TopBar right={<span className="w-11" aria-hidden="true" />} />;

  if (!ready) {
    return (
      <AppShell>
        {header}
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      </AppShell>
    );
  }

  if (!available || sub === null) {
    return (
      <AppShell>
        {header}
        <main className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
          <h1 className="text-xl font-extrabold text-ink-900">
            {available ? "로그인 정보가 없어요" : "지금은 로그인을 쓸 수 없어요"}
          </h1>
          <p className="text-sm leading-relaxed text-ink-600">
            로그인하지 않아도 모든 기능을 그대로 쓸 수 있어요. 답은 이 기기에 저장돼요.
          </p>
          <Link href="/find" className={buttonClass({ variant: "secondary", size: "md", full: false })}>
            질문으로 돌아가기
          </Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {header}
      <main className="flex flex-1 flex-col gap-6 pb-6 pt-2">
        <header className="flex flex-col gap-2.5">
          <Icon3D name="contract" size={48} />
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">답을 저장해 둘까요?</h1>
          <p className="text-[15px] leading-relaxed text-ink-700">
            동의하면 고른 답을 서버에 저장해서, 다른 기기에서 로그인해도 이어 볼 수 있어요.
          </p>
        </header>

        {/* 표 대신 세 마디 — 저장하는 것 · 보관 기간 · 동의하지 않으면 (11/23 시안). 세부 목록은 펼쳐서 본다. */}
        <section aria-label="저장 동의 내용" className="flex flex-col rounded-card bg-surface px-5 py-0.5 shadow-card">
          <ConsentRow label="저장하는 것" answer={SUMMARY}>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-normal text-warn-800">
              <TriangleAlert size={ICON_SM} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span className="text-balance">소득 · 재산 · 수급 여부처럼 민감한 답도 함께 저장돼요</span>
            </p>
            {open && (
              <div id="consent-items" className="mt-1.5 flex flex-col">
                <ItemList items={BASIC_ITEMS} />
                <div className="mt-2 flex flex-col rounded-control bg-warn-50 px-3 pt-0.5">
                  <p className="flex items-center gap-1.5 pb-2 pt-2.5 text-[13px] font-bold text-warn-800">
                    <TriangleAlert size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    민감할 수 있는 답 {SENSITIVE_ITEMS.length}가지
                  </p>
                  <ItemList items={SENSITIVE_ITEMS} sensitive />
                </div>
              </div>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="consent-items"
              onClick={() => setOpen((v) => !v)}
              className="focus-ring -mb-2.5 -ml-1.5 mt-0.5 inline-flex min-h-11 w-fit items-center gap-1 rounded-control px-1.5 text-sm font-bold text-brand-700"
            >
              {open ? "접기" : `${STORED_ITEMS.length}가지 하나씩 보기`}
              <ChevronDown size={ICON_SM} strokeWidth={2} aria-hidden="true" className={`shrink-0 text-brand-300 ${open ? "rotate-180" : ""}`} />
            </button>
          </ConsentRow>
          <span aria-hidden="true" className="h-px bg-ink-100" />
          <ConsentRow label="보관 기간" answer="마지막 저장 후 1년">
            <p className="text-sm leading-normal text-ink-600">그동안 저장이 없으면 저절로 지워져요.</p>
          </ConsentRow>
          <span aria-hidden="true" className="h-px bg-ink-100" />
          {/* [동의하지 않음] = logout() — 로그인 전에 고른 답은 서버에 간 적이 없으니 이 기기에 그대로 둔다 */}
          <ConsentRow label="동의하지 않으면" answer="로그아웃돼요">
            <p className="text-sm leading-normal text-ink-600">고른 답은 서버로 가지 않고 이 기기에만 남아요.</p>
          </ConsentRow>
        </section>

        <div className="flex flex-col gap-1">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-relaxed text-ink-500">
            {NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <Link href="/privacy" className="focus-ring inline-flex min-h-11 w-fit items-center gap-0.5 rounded-control text-sm font-bold text-brand-700">
            개인정보 처리방침 (초안)
            <ChevronRight size={ICON_SM} strokeWidth={2} aria-hidden="true" className="shrink-0 text-brand-300" />
          </Link>
        </div>

        {failed && (
          <p role="alert" className="rounded-control bg-warn-50 px-4 py-3 text-sm text-warn-800">
            지금은 저장하지 못했어요. 답은 이 기기에 그대로 있고, 다음에 다시 저장해요.
          </p>
        )}
      </main>

      <StickyBottomAction>
        <div className="flex flex-col gap-2">
          {failed ? (
            <Button onClick={() => replacePage(consumeReturnTo())}>계속하기</Button>
          ) : (
            <>
              <Button onClick={() => void agree()} disabled={working}>
                동의하고 저장
              </Button>
              <Button variant="text" size="md" onClick={() => void logout()} disabled={working}>
                동의하지 않음
              </Button>
            </>
          )}
        </div>
      </StickyBottomAction>

      {conflict && <SyncConflictSheet onResolved={() => replacePage(consumeReturnTo())} />}
    </AppShell>
  );
}

/** 요약 카드 한 줄 — 작은 회색 제목 + 굵은 답 한 줄 + 덧붙임. */
function ConsentRow({ label, answer, children }: { label: string; answer: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-4">
      <h2 className="text-[13px] font-bold leading-snug text-ink-500">{label}</h2>
      <p className="text-balance text-base font-bold leading-normal text-ink-900">{answer}</p>
      {children}
    </div>
  );
}

function ItemList({ items, sensitive = false }: { items: typeof STORED_ITEMS; sensitive?: boolean }) {
  return (
    <ul aria-label={sensitive ? "민감할 수 있는 답" : "저장하는 것 세부"} className="flex flex-col">
      {items.map((item) => (
        <li key={item.name} className={`flex flex-col gap-0.5 border-t py-2.5 ${sensitive ? "border-warn-200" : "border-ink-100"}`}>
          <span className="text-sm font-bold leading-snug text-ink-900">{item.name}</span>
          <span className="text-[13px] leading-normal text-ink-600">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
