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
  "가능성 있음": "bg-ok-50 text-ok-700 border-ok-200",
  "확인 필요": "bg-warn-50 text-warn-800 border-warn-200",
  "해당 없음": "bg-ink-100 text-ink-700 border-ink-200",
};

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
    <article
      className={
        dimmed
          ? "rounded-2xl border border-ink-200 bg-sand-50 p-4"
          : "rounded-2xl border border-ink-200 bg-white p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-snug text-ink-900">{policy.name}</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {policy.agency} · {benefitTypeLabel(policy.benefitType).split(" · ")[0]}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${TAG_STYLE[result.tag]}`}
          >
            {result.tag}
          </span>
          {ceiling && (
            <>
              <p className="mt-1 text-sm font-extrabold tabular-nums text-accent-600">
                {ceiling.label}
              </p>
              <p className="text-[10px] text-ink-500">공고 상한</p>
            </>
          )}
        </div>
      </div>

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
          신청 기간 {policy.applicationStart} ~ {policy.applicationEnd ?? "상시"} · 확인{" "}
          {policy.verifiedAt ?? "미검수"}
        </p>

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
