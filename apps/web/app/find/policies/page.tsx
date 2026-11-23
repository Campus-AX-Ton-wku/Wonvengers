"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import policiesJson from "@/data/policies.json";
import PolicyCard from "@/app/find/PolicyCard";
import { AppShell, BottomTabBar, Icon3D, TopBar } from "@/app/components";
import { ChevronRight, ICON_MD, ICON_SM, Info } from "@/app/components/icons";
import { resolveAnswers } from "@/lib/age";
import { hasStoredLogin, isLoginAvailable, onAuthChange } from "@/lib/auth";
import { candidateCount, groupPolicies, splitByApplicationWindow } from "@/lib/discovery";
import { todayISO } from "@/lib/date";
import { isTrustedRegion } from "@/lib/trust";
import { EMPTY_ANSWERS, loadAnswers, loadApplied, loadListing, loadProfile } from "@/lib/storage";
import type { DiscoveryAnswers, HousingType, PolicyMeta } from "@/lib/types";
import { notApplied } from "@/lib/applied";

/**
 * 1층 · 발견 — 질문 결과 목록.
 *
 * 답변은 localStorage 에만 있다(PRD F0-13). 읽기 전에 카드를 그리면 한 프레임 동안
 * 전부 '확인 필요'로 깜빡이므로, 불러오기 전에는 자리만 잡아 둔다.
 *
 * 답이 전부 '모름'이어도 목록은 보여준다 — 저장된 답변이 없는 상태와 구분할 수
 * 없고, 모름이어도 목록이 떠야 한다(QA체크리스트 1층).
 *
 * 화면에는 지금 신청할 수 있는 것만 둔다. 마감된 사업과 대상이 아닌 사업은 보여 주지 않는다
 * (11/17 팀 결정 — 예전에는 접어서 남겨 두었다). 후보가 전부 마감이면 제목이 그렇게 말한다.
 */

const policies = policiesJson as PolicyMeta[];

/**
 * 2층으로 보내는 CTA 문구. 사용자가 사는 계약을 그대로 부른다.
 *
 * 연세를 '월세'로 묶어 부르면, 이 앱이 유일하게 제대로 다루는 계약을 다른 앱처럼
 * 뭉뚱그리는 셈이다 (lib/rent.ts 의 월 환산). 주거 형태를 답하지 않았거나 '그 외'인
 * 사람에게는 둘 중 하나로 단정하지 않고 '주거비'라고 부른다.
 */
function ctaLabel(housingType: HousingType | null): string {
  if (housingType === "월세") return "지원받으면 내 월세는 얼마일까?";
  if (housingType === "연세") return "지원받으면 내 연세 부담은 얼마나 줄까?";
  if (housingType === "전세") return "지원받으면 내 전세 부담은 얼마일까?";
  return "지원받으면 내 주거비는 얼마일까?";
}

/** 계산한 적 있으면 결과로 — 같은 카드 꼴에 말만 바꾼다(11/23 시안 Tweak '계산 후'). */
function resultLabel(housingType: HousingType | null): string {
  if (housingType === "월세") return "내 월세 계산 결과 보기";
  if (housingType === "연세") return "내 연세 계산 결과 보기";
  if (housingType === "전세") return "내 전세 계산 결과 보기";
  return "내 주거비 계산 결과 보기";
}

export default function FindPoliciesPage() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>(EMPTY_ANSWERS);
  /** 신청 완료로 표시한 지원금 — 목록에서 뺀다(11/23 ggue, lib/applied.ts) */
  const [applied, setAppliedIds] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  // 정적 빌드 시점의 날짜가 HTML 에 박히면 안 되므로 브라우저에서 채운다.
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  // 로그인을 쓸 수 있는데 아직 안 한 사람. 같은 effect 에서 정해야 첫 화면에 파란 계산 버튼이 한 번 비쳤다 사라지지 않는다.
  const [guest, setGuest] = useState(false);
  // 계산 결과가 있으면 계산 카드는 결과(/result)로 간다. 결과 화면이 읽는 두 값(계약 조건 · 프로필)이 다 있을 때만.
  const [calculated, setCalculated] = useState(false);

  useEffect(() => {
    setAnswers(loadAnswers());
    setAppliedIds(loadApplied());
    setAsOf(todayISO());
    setCalculated(loadListing() !== null && loadProfile() !== null);
    const updateGuest = () => setGuest(isLoginAvailable() && !hasStoredLogin());
    updateGuest();
    setLoaded(true);
    return onAuthChange(updateGuest);
  }, []);

  // 1층과 같은 경계 변환. 생년월일 → 만 나이는 여기서 한 번만 한다 (lib/age.ts).
  const resolved = resolveAnswers(answers, asOf ?? null);

  const groups = groupPolicies(notApplied(policies, applied), resolved);
  const count = candidateCount(groups);

  // 접수가 끝난 정책도 1층 태그로는 '가능성 있음' 이 된다. 한 목록에 섞으면 제목의
  // 건수가 못 받는 것까지 세고, 금액이 가장 큰 마감 건이 첫 카드를 차지한다.
  const { 신청가능 } = asOf ? splitByApplicationWindow(groups, asOf) : { 신청가능: [] };

  // 계산(2층)으로 보낼 수 있는가. 후보가 없으면 계산할 것이 없다. 전세도 11/23 부터 계산한다.
  const canCalculate = count > 0;
  // 비회원은 계산 버튼과 하단 섬의 카카오 버튼을 하나로 합친다(11/23) — 둘 다 결국 카카오 로그인이라
  // [카카오로 로그인하고 홈으로]가 파란 계산 버튼을 덮고 서 있었다. 로그인 뒤 바로 계산 화면으로 간다.
  const mergedLogin = guest && canCalculate;

  return (
    <AppShell>
      {/* 하단 섬으로 들어오는 탭 첫 화면이라 뒤로 가기 대신 왼쪽 제목 — 관심 · 내 정보와 같은 꼴 (11/23 시안) */}
      <TopBar title="지원금" />
      {/* 등장 애니메이션은 main 에만 — AppShell 에 걸면 그 안의 상단바(sticky) · 하단 섬(fixed)이 iOS 에서 본문과 같이 스크롤된다 (11/20) */}
      <main className="step-in pb-10">

      {!loaded || !asOf ? (
        <p className="mt-10 text-center text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <>
          {/* 금액은 앞 화면(/find/result)이 크게 말했다. 여기서 또 보여주면 같은
              숫자를 두 번 붙는 셈이라 개수 한 줄만 둔다(11/23 — 관심 탭의 '관심 지원금 3'과 같은 꼴).

              후보는 있는데 전부 마감이면 '해당되는 것이 없어요' 로 말하면 안 된다.
              대상이 아니라는 뜻으로 읽히지만 실제로는 다음 회차를 기다리면 된다.

              11/23 시안: 답 줄 · [처음부터 다시] · [조건 수정]을 뺐다. 조건은 홈 · 내 정보에서 고치고,
              처음부터 다시는 조건 수정 화면(/find) · 결과 화면(/find/result)에 있다. */}
          {신청가능.length > 0 ? (
            <h2 className="mt-1 text-[15px] font-bold leading-snug text-ink-700">
              받을 수 있는 주거 혜택 <strong className="font-extrabold text-brand-800">{신청가능.length}</strong>
              <span className="sr-only">개</span>
            </h2>
          ) : (
            <h2 className="mt-2 text-xl font-extrabold leading-snug text-ink-900">
              {count > 0 ? "지금 받을 수 있는 주거 혜택이 없어요" : "아쉽게도 해당되는 주거 혜택이 없어요"}
            </h2>
          )}

          {!isTrustedRegion(resolved.region) && (
            <p className="mt-4 flex items-start gap-2 rounded-control bg-ink-100 p-3.5 text-xs leading-relaxed text-ink-600">
              <Info size={ICON_SM} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
              <span>이 지역은 아직 정보를 모으는 중이라 빠진 지원이 있을 수 있어요.</span>
            </p>
          )}

          {/* 카드 사이는 여백으로 가른다. 구분선을 함께 쓰면 목록이 표처럼 읽힌다. */}
          <section
            aria-label={`받을 수 있는 주거 혜택 ${신청가능.length}개`}
            className="mt-3.5 space-y-3"
          >
            {신청가능.map(({ policy, result }, i) => (
              <div
                key={policy.id}
                className="stagger-in"
                /* 지연 상한 225ms — 카드가 5장이어도 마지막 장을 기다리지 않는다. */
                style={{ animationDelay: `${Math.min(i * 45, 225)}ms` }}
              >
                <PolicyCard policy={policy} result={result} asOfISO={asOf} />
              </div>
            ))}
          </section>

          {count === 0 && (
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              <Link href="/find" className="font-bold text-brand-700 underline">
                답변 바꾸기
              </Link>
            </p>
          )}

          {/* 다음에 할 일 하나. 목록이 답한 것은 '얼마까지'이고, 사용자가 실제로
              궁금한 것은 '그래서 내 주거비가 얼마가 되나'다.
              11/23 까지 전세 거주자에게는 이 CTA 대신 '아직 계산할 수 없어요'를 보였다 —
              계산 화면이 월세·연세만 받았다. 이제 전세도 받는다(대출 이자 + 관리비). */}
          {/* 계산 카드는 옅은 파랑 — 화면에서 가장 진한 파랑은 하단 섬의 '지원금'과 동그란 › 뿐이다(11/23 시안). */}
          {canCalculate && !mergedLogin && (
              <Link
                href={calculated ? "/result" : "/calculate"}
                className="press focus-ring mt-6 flex min-h-20 items-center gap-3.5 rounded-card bg-brand-50 py-4 pl-4 pr-3.5 ring-1 ring-inset ring-brand-100"
              >
                <Icon3D name="calculator" size={48} />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-base font-extrabold leading-snug text-ink-900">
                    {calculated ? resultLabel(resolved.housingType) : ctaLabel(resolved.housingType)}
                  </span>
                  <span className="text-balance text-[13px] leading-normal text-ink-600">
                    {calculated ? "조건을 바꿔 다시 계산할 수도 있어요" : "계약 조건을 넣으면 실제로 내는 돈을 알려 줘요"}
                  </span>
                </span>
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600">
                  <ChevronRight size={ICON_MD} strokeWidth={2.4} className="text-white" />
                </span>
              </Link>
            )}

          {/* 고지는 본문과 같은 무게로 두지 않는다. 가는 선 아래 작은 각주(11/23 시안).
              그러나 접지는 않는다 — 접을 수 있는 고지는 고지가 아니다. 문장은 그대로. */}
          <div className="mt-6 flex gap-2 border-t border-ink-100 pt-3.5">
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
            <p className="text-xs leading-relaxed text-ink-500">
              나이 · 지역 · 현재 상태 · 소득 구간 · 주거 형태만 비교한 결과라
              <strong className="font-bold text-ink-700"> 신청 자격을 확정하지 않습니다.</strong>{" "}
              최종 심사는 각 기관이 하니 공식 페이지에서 확인하세요.
            </p>
          </div>
        </>
      )}
      </main>
      {/* 지원금 탭의 첫 화면 — 로그인한 사람에게만 하단 섬이 보인다 (BottomTabBar).
          월세 계산은 로그인하고 한다(11/17) — 비회원의 계산 입구는 하단 섬의 카카오 버튼 하나다. */}
      <BottomTabBar
        active="benefit"
        guestAction={
          mergedLogin
            ? {
                // 한 줄에 다 들어가지 않는 길이라 끊을 자리를 정해 둔다 — 맡겨 두면 '내'가 윗줄 끝에 붙는다.
                label: (
                  <span className="text-center leading-snug">
                    <span className="block">카카오로 로그인하고</span>{" "}
                    <span className="block">내 최종 주거비 확인하기</span>
                  </span>
                ),
                returnTo: "/calculate",
              }
            : undefined
        }
      />
    </AppShell>
  );
}
