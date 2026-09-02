import { formatKoreanMoney } from "@/lib/money";
import { ICON_SM, TriangleAlert } from "./icons";

/**
 * 2층 결과의 두 숫자 — 받는 돈과 내는 돈.
 *
 * 이 앱의 모든 흐름이 이 카드를 만들기 위해 있다. 그래서 규칙이 셋이다.
 *
 * 1. **금색은 받는 돈에만.** 아래 '최종 예상 주거비'는 내는 돈이라 중립색(ink)이다.
 *    둘 다 물들이면 "이 색 = 지원금" 신호가 죽는다.
 * 2. **크기도 갈라놓는다.** 전에는 둘 다 text-3xl 이라 색만 달랐는데, 지출액이
 *    자릿수가 하나 더 많아 시각적으로 압도했다 — 자릿수가 색을 이긴다.
 *    (text-5xl 로 올렸다가 되돌렸다. 390px 폭에서 '304만 4,000원'이 두 줄로 넘쳐
 *     '원'만 다음 줄에 떨어졌다. 만 단위 표기가 원 단위보다 길어질 수 있다.)
 * 3. **금액은 만·억 단위로만 적는다.** 이 카드는 캡처되어 공유된다. 원 단위
 *    전체 자릿수를 넣으면 훑는 눈이 자릿수를 세게 된다.
 *
 * 라벨과 금액은 형제로 붙어 있어야 한다 — 테스트가 `label.nextElementSibling` 로
 * 금액을 집는다. 사이에 래퍼를 끼우지 말 것.
 */
export function ResultSummary({
  supportAmount,
  finalCost,
  nominalTotal,
  unknownConditions,
}: {
  supportAmount: number;
  finalCost: number;
  nominalTotal: number;
  /** 이 금액에 아직 확인되지 않은 조건이 섞여 있으면 그 목록. */
  unknownConditions: { policy: string; label: string }[];
}) {
  return (
    <section className="amount-in rounded-card bg-surface p-5 shadow-card">
      {/* 받는 돈 — 화면에서 가장 큰 숫자. Perky 의 모자·동전과 같은 금색 면에 올린다. */}
      <div className="rounded-control bg-accent-50 px-4 py-4">
        <p className="text-xs font-bold text-accent-700">최대 지원 가능액 (12개월 기준)</p>
        <p className="mt-1 text-4xl font-extrabold leading-tight text-accent-600 tabular-nums">
          {formatKoreanMoney(supportAmount)}
        </p>
      </div>

      {/* 내는 돈 — 같은 카드 안이지만 면을 나누지 않는다. 색과 크기로만 갈린다. */}
      <div className="mt-4 px-1">
        <p className="text-xs font-semibold text-ink-500">
          최종 예상 주거비 (명목 지출 − 최대 지원 가능액)
        </p>
        <p className="mt-1 text-xl font-extrabold leading-tight text-ink-900 tabular-nums">
          {formatKoreanMoney(finalCost)}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          명목 총 지출 {formatKoreanMoney(nominalTotal)} 기준
        </p>
      </div>

      {unknownConditions.length > 0 && (
        <div className="mt-4 rounded-control bg-warn-50 p-3.5 text-xs text-warn-800">
          <p className="flex items-start gap-1.5 font-bold">
            <TriangleAlert size={ICON_SM} aria-hidden="true" className="mt-px shrink-0" />
            <span>이 금액에는 아직 확인되지 않은 조건이 포함되어 있습니다</span>
          </p>
          <ul className="mt-1.5 list-disc pl-5 leading-relaxed">
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
