import { formatKoreanMoney } from "@/lib/money";
import { monthlyRentEquivalent } from "@/lib/rent";
import type { ListingInput, PolicyMeta } from "@/lib/types";
import { Disclosure } from "@/app/components";
import { ICON_SM, TriangleAlert } from "@/app/components/icons";

/**
 * 결과 화면 맨 위 돈 요약 — 영수증 한 장 (11/18).
 *
 * 예전에는 같은 돈 이야기가 네 곳에 흩어져 있었다: 제목 아래 파란 금액 줄 · 요약 카드(지원액 · 최종 주거비 ·
 * '명목 총 지출') · '이 금액은 아래 조합으로 계산했습니다' 카드 · '계약 시 필요한 목돈' 카드.
 * 같은 254만원이 네 번 나오고, '명목 지출 − 최대 지원 가능액' 같은 수식이 라벨에 들어 있었다.
 * 그래서 영수증처럼 한 장에 — 내는 돈 − 받는 지원 = 실제 부담, 그리고 한 달 부담.
 *
 * 지켜 온 규칙은 그대로 (예전 ResultSummary 주석):
 * 1. 금색은 받는 돈(맨 위 지원액)에만. 영수증 줄과 최종 주거비는 잉크색이다
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
  unknownConditions,
}: {
  listing: ListingInput;
  supportAmount: number;
  finalCost: number;
  /** 맨 위 합계(최선 조합)에 든 정책. oneTime 은 한 번 주는 지원(이사비 등) */
  included: { id: string; name: string; amount: number; oneTime: boolean }[];
  /** 중복 수급 제한으로 조합에서 빠진 정책 */
  overlapExcluded: { policy: PolicyMeta; conflictsWith: string[] }[];
  /** 이 금액에 아직 확인되지 않은 조건이 섞여 있으면 그 목록 */
  unknownConditions: { policy: string; label: string }[];
}) {
  // lib/rent.ts nominalTotalCost 와 같은 셈 — 기간은 12개월까지만 센다
  const months = Math.min(listing.months, 12);
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

  return (
    <section className="amount-in rounded-card border border-ink-200 bg-surface p-5 shadow-card">
      <div>
        <p className="text-xs font-bold text-ink-500">최대 지원 가능액 ({months}개월 기준)</p>
        <p className="mt-1 text-4xl font-extrabold leading-tight text-accent-700 tabular-nums">
          {formatKoreanMoney(supportAmount)}
        </p>
        {/* 자격 미확정 고지는 맨 아래에 전체 문장이 있지만 금액과 2화면 떨어져 있었다(11/19) — 숫자 바로 밑에 한 줄 */}
        <p className="mt-1 text-xs text-ink-500">최종 금액은 각 기관이 심사해 정해요</p>
      </div>

      {/* 영수증 줄 — 내는 돈 위, 받는 지원을 빼고, 굵은 선 아래 실제 부담 */}
      <dl className="mt-4 flex flex-col gap-1.5 border-t border-ink-100 pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-600">월세·관리비 {months}개월</dt>
          <dd className="shrink-0 font-semibold text-ink-900 tabular-nums">{formatKoreanMoney(rentAndFee)}</dd>
        </div>
        {listing.oneTimeMoveCost > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-600">이사비</dt>
            <dd className="shrink-0 font-semibold text-ink-900 tabular-nums">{formatKoreanMoney(listing.oneTimeMoveCost)}</dd>
          </div>
        )}
        {included.length > 0 ? (
          included.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 text-ink-600">
                <span className="text-xs text-ink-500">받는 지원 · </span>
                {item.name}
              </dt>
              <dd className="shrink-0 font-semibold text-ink-900 tabular-nums">− {formatKoreanMoney(item.amount)}</dd>
            </div>
          ))
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-600">받는 지원</dt>
            <dd className="shrink-0 text-xs text-ink-500">합칠 수 있는 지원이 아직 없어요</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 border-t-2 border-ink-900 pt-3">
        <p className="text-xs font-bold text-ink-600">최종 예상 주거비 ({months}개월 실제 부담)</p>
        <p className="mt-1 text-xl font-extrabold leading-tight text-ink-900 tabular-nums">
          {formatKoreanMoney(finalCost)}
        </p>
        {monthlyLine && <p className="mt-1 text-xs text-ink-600">{monthlyLine}</p>}
      </div>

      {overlapExcluded.length > 0 && (
        <Disclosure label={`같이 받을 수 없어 뺀 지원 ${overlapExcluded.length}개`}>
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
      {unknownConditions.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-4 text-xs text-ink-600">
          <p className="flex items-start gap-2 font-bold text-ink-700">
            <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-px shrink-0 text-warn-800" />
            <span>이 금액에는 아직 확인되지 않은 조건이 들어 있어요</span>
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed">
            {unknownConditions.map((u, i) => (
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
