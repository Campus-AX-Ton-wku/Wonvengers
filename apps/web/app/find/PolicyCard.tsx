import type { PolicyMeta, TagResult } from "@/lib/types";
import { getRequiredQuestions } from "@/lib/questions";
import { benefitCeiling, benefitTypeLabel } from "@/lib/benefit";
import { isWithinWindow } from "@/lib/date";
import Disclosure from "@/app/Disclosure";

/**
 * 1층 정책 카드.
 *
 * 목록의 목적은 "무엇을 받을 수 있고 최대 얼마짜리인가"를 한 화면에서 훑는 것이다.
 * 그래서 카드 위쪽 한 줄에 태그·정책명·상한 금액만 두고, 공고 문구·확인 항목·
 * 신청 정보는 토글 안으로 내렸다.
 *
 * 판정 이유(해당 없음·확인 필요)는 접지 않는다 — 왜 이 태그가 붙었는지는 태그와
 * 함께 읽혀야 한다 (PRD F0-5).
 *
 * 금액은 공고 상한이다. 1층은 계약 조건을 모르므로 개인별 예상액을 계산할 수 없고,
 * 그래서 '공고 상한'이라고 적어 2층의 예상액과 구분한다 (PRD F0-9).
 */

const TAG_STYLE: Record<TagResult["tag"], string> = {
  "가능성 있음": "bg-ok-50 text-ok-700",
  "확인 필요": "bg-warn-50 text-warn-800",
  "해당 없음": "bg-ink-100 text-ink-700",
};

/**
 * 접수가 끝난 정책의 태그는 색을 뺀다.
 *
 * 1층 태그는 나이·지역·상태·소득만 보므로 마감된 정책도 '가능성 있음'이 된다
 * (PRD F3-6, 의도된 결정 — 문구는 그대로 둔다). 그런데 초록은 "지금 받을 수 있다"는
 * 신호라, 못 받는 카드에 그 색이 붙으면 문구를 읽기 전에 이미 잘못 안심시킨다.
 * 색은 행동할 수 있는 상태에만 남긴다.
 */
const CLOSED_TAG_STYLE = "bg-ink-100 text-ink-600";

export default function PolicyCard({
  policy,
  result,
  asOfISO,
}: {
  policy: PolicyMeta;
  result: TagResult;
  /** 판정 기준일. 없으면 접수 기간 안내를 그리지 않는다(서버 렌더링 시점). */
  asOfISO?: string;
}) {
  const dimmed = result.tag === "해당 없음";
  // 정책이 요구하는 입력 항목의 사람이 읽는 라벨. 2층 질문과 같은 출처를 쓴다.
  const extraConditions = getRequiredQuestions([policy])
    .filter((q) => q.key !== "birthDate")
    .map((q) => q.label);
  const ceiling = benefitCeiling(policy);
  // 1층 태그는 나이·지역·상태·소득만 본다. 접수 기간이 지난 정책도 '가능성 있음'이
  // 되기 때문에, 기간은 태그와 별도로 알려 준다 (PRD F3-6 과 같은 사실을 1층에서도).
  const window = asOfISO
    ? isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd)
    : "within";

  return (
    /*
     * 상자가 아니라 목록의 한 줄이다.
     *
     * 처음에는 테두리만 걷어내고 흰 카드로 뒀는데, 페이지 배경도 흰색이라
     * (globals.css 의 body) 카드끼리 전혀 구분되지 않았다. 여백만으로 나뉘려면
     * 토스 계좌 목록처럼 줄이 한두 줄로 짧아야 하는데, 정책 카드는 이름·기관·
     * 금액·판정 이유·토글까지 담은 덩어리라 그 방식이 통하지 않는다.
     *
     * 그래서 토스가 계좌 그룹을 나눌 때 쓰는 hairline 을 정책 사이에 둔다.
     * 구분선은 부모 <section> 의 divide-y 가 그린다 — 여기서는 위아래 여백만 잡는다.
     */
    <article className={`py-6 ${dimmed ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        {/* break-keep — 한글은 기본값이면 어절 중간에서 끊긴다 ('지원사 / 업'). */}
        <h3 className="min-w-0 break-keep text-base font-bold leading-snug text-ink-900">
          {policy.name}
        </h3>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            window === "after" ? CLOSED_TAG_STYLE : TAG_STYLE[result.tag]
          }`}
        >
          {result.tag}
        </span>
      </div>

      <p className="mt-1 text-xs text-ink-500">
        {policy.agency} · {benefitTypeLabel(policy.benefitType).split(" · ")[0]}
        {/* 접수 기간은 태그가 보지 않는 사실이다(위 주석 참고). 태그·금액만 훑는
            사람에게는 아래 본문의 문장이 늦으므로 여기서 한 번 더 말한다. */}
        {window === "after" && <span className="font-bold text-ink-600"> · 접수 마감</span>}
      </p>

      {ceiling && (
        /* 라벨 작게 위, 값 크게 아래. 금액을 오른쪽 구석에 작게 두면 목록을 훑을 때
           "무엇을 최대 얼마까지" 라는 질문에 답하지 못한다.
           마감된 정책의 금액에는 accent 를 쓰지 않는다 — accent 는 '받을 수 있는 돈'
           신호라, 지금 신청할 수 없는 금액에 주면 가장 큰 혜택처럼 읽힌다. */
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-ink-500">공고 상한</p>
          {/* tabular-nums 를 쓰지 않는다. 자릿수를 세로로 맞출 표가 아니고, 이
              한글 폰트에서는 등폭 숫자가 눈에 띄게 벌어져 '4 80만원' 처럼 읽힌다. */}
          <p
            className={`text-2xl font-extrabold leading-tight ${
              window === "after" || dimmed ? "text-ink-500" : "text-accent-600"
            }`}
          >
            {ceiling.label}
          </p>
        </div>
      )}

      {/* 왜 이 태그인지는 접지 않는다. 태그만 보고는 이유를 알 수 없다. */}
      {result.tag === "해당 없음" && (
        <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-ink-600">
          {result.failReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {result.tag === "확인 필요" && (
        <p className="mt-2 text-xs leading-relaxed text-warn-800">
          {result.unknownFields.join(" · ")}을(를) 답하지 않아 판단을 보류했습니다.
        </p>
      )}

      {window === "after" && (
        <p className="mt-2 text-xs leading-relaxed text-ink-600">
          <strong className="text-ink-900">{policy.applicationEnd}에 접수가 끝났습니다.</strong>{" "}
          다음 모집 공고를 기다려야 합니다.
        </p>
      )}

      {window === "before" && (
        <p className="mt-2 text-xs leading-relaxed text-ink-600">
          <strong className="text-ink-900">{policy.applicationStart}부터 접수합니다.</strong>
        </p>
      )}

      <Disclosure label={`자세히 보기 · 확인할 항목 ${extraConditions.length}개`} className="mt-3">
        <p className="text-xs font-bold text-ink-900">{policy.benefitSummary}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          공고 기준 상한이며, 실제 지원액은 심사에 따라 달라집니다.
        </p>

        {extraConditions.length > 0 && (
          <>
            <p className="mt-3 text-xs font-bold text-ink-600">추가로 확인할 것</p>
            <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-ink-600">
              {extraConditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-3 text-xs text-ink-500">
          신청 기간 {policy.applicationStart} ~ {policy.applicationEnd ?? "상시"}
        </p>

        {/* 이 숫자들이 어느 공고에서 온 값인지, 언제 대조한 것인지를 카드 안에서 밝힌다.
            앱 데이터는 팀이 공고를 손으로 옮긴 값이라 원문으로 가는 길이 있어야 한다. */}
        <div className="mt-3 border-t border-ink-200 pt-3">
          <p className="text-xs font-bold text-ink-600">이 정보의 출처</p>
          <a
            href={policy.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-semibold text-brand-700 underline hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            공고 원문 →
          </a>
          {policy.verifiedAt ? (
            <p className="mt-1 text-[11px] text-ink-500">
              팀이 {policy.verifiedAt}에 공고 원문과 대조했습니다.
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-semibold text-warn-800">
              아직 공고 원문과 대조하지 않았습니다. 신청 전에 원문을 직접 확인하세요.
            </p>
          )}
        </div>

        <a
          href={policy.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          공식 페이지 →
        </a>
      </Disclosure>
    </article>
  );
}
