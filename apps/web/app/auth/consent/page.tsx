"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Button, StickyBottomAction, SyncConflictSheet, TopBar, buttonClass } from "@/app/components";
import { consumeReturnTo, isLoginAvailable, recordConsent, storedSub } from "@/lib/auth";
import { replacePage } from "@/lib/redirect";
import { initialSync, logout } from "@/lib/sync";

/** 저장하는 것. 민감할 수 있는 항목은 따로 표시한다(설계 '화면' 3 — 소득·재산·수급 여부). */
const STORED_ITEMS: { name: string; detail: string; sensitive?: boolean }[] = [
  { name: "첫 질문의 답", detail: "생년월일, 사는 곳, 현재 상태, 월 소득 구간, 주거 형태" },
  { name: "계약 조건", detail: "지역, 계약 형태, 보증금·월세·관리비, 계약 시작일, 거주 개월 수" },
  {
    name: "자격 질문의 답",
    detail: "가구원 수, 본인·부모 가구 소득, 재산 기준 충족 여부, 기초생활수급·차상위 여부, 무주택 여부 등",
    sensitive: true,
  },
  { name: "결과 화면에서 답한 조건", detail: "정책마다 직접 답한 '확인 필요' 조건" },
  { name: "신청 체크리스트", detail: "정책마다 확인 표시한 항목" },
];

const FACTS: { term: string; desc: string }[] = [
  { term: "목적", desc: "다른 기기에서 이어 보기" },
  { term: "보관 기간", desc: "마지막 저장 후 1년. 그동안 저장이 없으면 자동으로 지워져요" },
  { term: "저장 위치", desc: "AWS 서울 리전(대한민국)" },
  {
    term: "카카오 회원번호",
    desc: "로그인 서비스(Amazon Cognito)에만 남아요. 답 저장소에는 로그인 서비스가 만든 무작위 번호만 저장해요",
  },
  { term: "지우는 방법", desc: "'처음부터 다시'로 답을 비우거나, 내 계정 › 회원 탈퇴로 전부 지울 수 있어요" },
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
      <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
        <header>
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">답을 저장해 둘까요?</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            동의하면 고른 답을 서버에 저장해 다른 기기에서도 이어 볼 수 있어요. 동의하기 전에는 아무것도 보내지 않았어요.
          </p>
        </header>

        <section aria-labelledby="consent-items">
          <h2 id="consent-items" className="text-sm font-bold text-ink-900">
            저장하는 것
          </h2>
          <table className="mt-2 w-full text-left text-xs leading-relaxed">
            <tbody>
              {STORED_ITEMS.map((item) => (
                <tr key={item.name} className="border-t border-ink-100 align-top">
                  <th scope="row" className="w-28 py-2.5 pr-3 font-bold text-ink-700">
                    {item.name}
                    {item.sensitive && (
                      <span className="mt-1 block w-fit rounded bg-warn-50 px-1.5 py-0.5 text-[11px] font-bold text-warn-800">
                        민감 정보
                      </span>
                    )}
                  </th>
                  <td className="py-2.5 text-ink-600">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <dl className="flex flex-col gap-3 rounded-control bg-ink-50 p-4 text-xs leading-relaxed">
          {FACTS.map((fact) => (
            <div key={fact.term}>
              <dt className="font-bold text-ink-700">{fact.term}</dt>
              <dd className="mt-0.5 text-ink-600">{fact.desc}</dd>
            </div>
          ))}
        </dl>

        <Link href="/privacy" className="focus-ring inline-flex min-h-11 w-fit items-center text-sm font-bold text-brand-700 underline">
          개인정보 처리방침 (초안)
        </Link>

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
