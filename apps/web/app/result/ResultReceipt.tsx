import { formatKoreanMoney } from "@/lib/money";
import { calcMonths, monthlyRentEquivalent } from "@/lib/rent";
import type { ListingInput, PolicyMeta } from "@/lib/types";
import { Disclosure, PerkyCharacter } from "@/app/components";
import { ICON_SM, TriangleAlert } from "@/app/components/icons";

/**
 * 결과 화면 맨 위 돈 요약 — 영수증 한 장 (11/18).
 *
 * 예전에는 같은 돈 이야기가 네 곳에 흩어져 있었다: 제목 아래 파란 금액 줄 · 요약 카드(지원액 · 최종 주거비 ·
 * '명목 총 지출') · '이 금액은 아래 조합으로 계산했습니다' 카드 · '계약 시 필요한 목돈' 카드.
 * 같은 254만원이 네 번 나오고, '명목 지출 − 최대 지원 가능액' 같은 수식이 라벨에 들어 있었다.
 * 그래서 영수증처럼 한 장에 — 내는 돈 − 받는 지원 = 실제 부담, 그리고 한 달 부담.
 *
 * 11/20 시안 '계산 결과 · 영수증 한 장': 맨 위 '받을 수 있는 지원' + 개월 칩 + 찾은 Perky, 영수증 줄은
 * 옅은 회색 상자('N개월 동안 내 주거비') 안에, 최종 예상 주거비는 그 상자의 굵은 선 아래.
 *
 * 지켜 온 규칙 (예전 ResultSummary 주석):
 * 1. 받는 돈(맨 위 지원액)만 금액 색(남색 brand-900). 영수증 줄과 최종 주거비는 잉크색이다
 *    (11/20 금색 → 남색, ggue 결정 — 시안 전체가 금액을 남색으로 그렸다)
 * 2. 지원액이 최종 주거비보다 큰 글씨다 — 자릿수가 색을 이긴다
 * 3. 금액은 만 · 억 단위로만 (formatKoreanMoney). 이 카드는 캡처되어 공유된다
 * 4. 어떤 지원을 더했는지(F4-5)는 접지 않는다 — '받는 지원' 줄이 그 목록이다
 * 라벨과 금액은 형제로 붙어 있어야 한다 — 테스트가 label.nextElementSibling 로 금액을 집는다.
 */
export function ResultReceipt({
  listing,
  supportAmount,
  finalCost,
  included,
  overlapExcluded,
  pending,
  selfConfirmed,
}: {
  listing: ListingInput;
  supportAmount: number;
  finalCost: number;
  /** 맨 위 합계(최선 조합)에 든 정책. oneTime 은 한 번 주는 지원(이사비 등) */
  included: { id: string; name: string; amount: number; oneTime: boolean }[];
  /** 중복 수급 제한으로 조합에서 빠진 정책 */
  overlapExcluded: { policy: PolicyMeta; conflictsWith: string[] }[];
  /** 이 금액에 아직 확인되지 않은 조건이 섞여 있으면 그 목록 */
  /** 합계 중 아직 확인하지 않은 조건이 걸린 몫(11/23 ggue, lib/summary.ts pendingSupport) — 보통 0(결과 전 '확인할 것'에서 답한다) */
  pending: { amount: number; conditions: { policy: string; label: string }[] };
  /** 합계에 든 지원 중 '확인할 것'에서 직접 답해 정해진 조건 — 신청할 때 기관이 다시 확인한다 */
  selfConfirmed?: { policy: string; label: string }[];
}) {
  // lib/rent.ts nominalTotalCost · 지원금과 같은 기간 — 입력한 거주 개월 수
  const months = calcMonths(listing);
  const rentAndFee = (monthlyRentEquivalent(listing) + listing.managementFee) * months;
  // 매달 나가는 돈과 한 번 내는 돈을 나눈다(11/18 진단 2회차) — 이사비를 12개월로 나눠 '한 달에 약 …'으로 쓰면
  // 실제로 매달 나가는 돈보다 크게 읽힌다. 한 번 주는 지원은 이사비에서 먼저 빼고, 남으면 매달 쪽에서 뺀다.
  const monthlySupport = included.filter((i) => !i.oneTime).reduce((sum, i) => sum + i.amount, 0);
  const oneTimeSupport = included.filter((i) => i.oneTime).reduce((sum, i) => sum + i.amount, 0);
  const moveNet = Math.max(0, listing.oneTimeMoveCost - oneTimeSupport);
  const leftover = Math.max(0, oneTimeSupport - listing.oneTimeMoveCost);
  const recurringNet = Math.max(0, rentAndFee - monthlySupport - leftover);
  const monthly = months > 0 ? Math.round(recurringNet / months / 100) * 100 : 0;
  const monthlyLine =
    monthly > 0 || moveNet > 0
      ? `매달 약 ${formatKoreanMoney(monthly)}${moveNet > 0 ? ` + 이사비 ${formatKoreanMoney(moveNet)}(한 번)` : ""}`
      : null;

  // 한 화면에 Perky 하나 — 받을 지원이 있으면 찾은 얼굴, 없으면 빈손
  const pose = supportAmount > 0 ? "found" : "empty";

  return (
    <section className="amount-in relative flex flex-col gap-4 rounded-card bg-surface px-5 pb-5 pt-[22px] shadow-card">
      {/* 캐릭터는 상태를 말하는 자리에만. 같은 뜻을 옆 금액이 말하므로 읽지 않는다(PerkyCharacter 의 alt="") */}
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 w-[84px]">
        <PerkyCharacter state={pose} size={168} className="h-auto w-[84px]" />
      </span>

      <div className="flex min-h-[92px] flex-col gap-1 pr-[92px]">
        {/* 라벨 글자와 개월 칩이 한 줄. 라벨 <p> 바로 다음 형제가 금액이다(테스트가 nextElementSibling 로 집는다) */}
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-600">
          받을 수 있는 지원
          <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-ink-100 px-2 text-xs font-bold text-ink-600">
            {months}개월 기준
          </span>
        </p>
        {/* break-keep — 좁은 화면에서는 '254만' / '4,000원' 처럼 단위에서만 꺾인다 */}
        <p className="break-keep text-3xl font-extrabold leading-tight tracking-[-0.03em] text-brand-900">
          {formatKoreanMoney(supportAmount)}
        </p>
        {/* 자격 미확정 고지는 맨 아래에 전체 문장이 있지만 금액과 2화면 떨어져 있었다(11/19) — 숫자 바로 밑에 한 줄 */}
        <p className="text-xs text-ink-500">최종 금액은 각 기관이 심사해 정해요</p>
        {/* 확인 안 된 지원은 위 큰 숫자에 더하지 않고, 바로 밑에 따로 — 무엇을 확인하면 되는지는 영수증 아래 */}
        {/* 11/23 ggue: 조건을 확인해야 받는 금액도 위 숫자에 넣는다 — 대신 그렇다고 바로 밑에 밝힌다 */}
        {(pending.amount > 0 || (selfConfirmed?.length ?? 0) > 0) && (
          <p className="text-[13px] font-bold text-warn-800">추가로 조건을 확인해야 하는 금액이 들어 있어요</p>
        )}
      </div>

      {/* 영수증 — 내는 돈 위, 받는 지원을 빼고, 굵은 선 아래 실제 부담 (시안 '영수증 한 장', 11/20) */}
      <div className="flex flex-col gap-3 rounded-control bg-ink-50 p-4">
        <p className="text-[13px] font-bold text-ink-700">{months}개월 동안 내 주거비</p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            {/* 전세의 매달 나가는 돈은 대출 이자다(lib/rent.ts). 보증금은 돌려받는 돈이라 줄을 두지 않는다. */}
            <dt className="text-ink-600">
              {listing.contractType === "전세" ? "대출 이자·관리비" : "월세·관리비"} {months}개월
            </dt>
            <dd className="shrink-0 text-[15px] font-bold text-ink-900 tabular-nums">{formatKoreanMoney(rentAndFee)}</dd>
          </div>
          {listing.oneTimeMoveCost > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-600">이사비</dt>
              <dd className="shrink-0 text-[15px] font-bold text-ink-900 tabular-nums">{formatKoreanMoney(listing.oneTimeMoveCost)}</dd>
            </div>
          )}
          {included.length > 0 ? (
            included.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 text-ink-600">
                  <span className="text-xs text-ink-500">받는 지원 · </span>
                  {item.name}
                </dt>
                <dd className="shrink-0 text-[15px] font-bold text-ink-900 tabular-nums">− {formatKoreanMoney(item.amount)}</dd>
              </div>
            ))
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-600">받는 지원</dt>
              <dd className="shrink-0 text-xs text-ink-500">
                합칠 수 있는 지원이 아직 없어요
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-0.5 border-t-2 border-ink-900 pt-3">
          <p className="text-sm font-bold text-ink-900">최종 예상 주거비</p>
          <p className="break-keep text-2xl font-extrabold leading-tight tracking-[-0.02em] text-ink-900">
            {formatKoreanMoney(finalCost)}
          </p>
          {monthlyLine && <p className="text-[13px] leading-normal text-ink-600">지원을 빼고 실제로 낼 돈 · {monthlyLine}</p>}
        </div>
      </div>

      {overlapExcluded.length > 0 && (
        <Disclosure className="" label={`같이 받을 수 없어 뺀 지원 ${overlapExcluded.length}개`}>
          <ul className="flex flex-col gap-2 px-1 text-sm leading-relaxed text-ink-600">
            {overlapExcluded.map((x) => (
              <li key={x.policy.id}>
                <strong className="text-ink-700">{x.policy.name}</strong> — {x.conflictsWith.join(" · ")}과(와) 같이 받을 수
                없어, 금액이 더 큰 쪽만 넣었어요.
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {/* 계약 당일 필요한 현금(보증금) 줄은 11/20 뺐다(ggue) — 계약하는 사람은 보증금을 당일 낸다는 걸 이미 안다 */}
      {/* 11/23 ggue: 조건을 확인해야 받는 금액도 합계에 넣고, 그 조건은 결과 전 '확인할 것'에서 반드시 답한다(lib/confirm.ts).
          직접 답한 조건은 신청할 때 기관이 다시 확인한다고 밝힌다. 아직 답하지 않은 조건이 남아 있으면 확인하러 보낸다 */}
      {selfConfirmed && selfConfirmed.length > 0 && (
        <div className="border-t border-ink-100 pt-4 text-xs text-ink-600">
          <p className="flex items-start gap-2 font-bold text-ink-700">
            <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-px shrink-0 text-warn-800" />
            <span>직접 확인한 조건이 들어 있어요 — 신청할 때 기관이 다시 확인해요</span>
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed">
            {selfConfirmed.map((u, i) => (
              <li key={i}>
                [{u.policy}] {u.label}
              </li>
            ))}
          </ul>
          <a href="/result/confirm" className="focus-ring mt-2 inline-flex min-h-11 items-center rounded px-1 font-bold text-brand-700 underline underline-offset-[3px]">
            답 고치기
          </a>
        </div>
      )}
      {pending.amount > 0 && pending.conditions.length > 0 && (
        <div className="border-t border-ink-100 pt-4 text-xs text-ink-600">
          <p className="flex items-start gap-2 font-bold text-ink-700">
            <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-px shrink-0 text-warn-800" />
            <span>위 금액 중 {formatKoreanMoney(pending.amount)}은 아직 확인하지 않은 조건이 걸려 있어요</span>
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed">
            {pending.conditions.map((u, i) => (
              <li key={i}>
                [{u.policy}] {u.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
