import type { PolicyMeta, TagResult } from "@/lib/types";
import { getRequiredQuestions } from "@/lib/questions";
import { benefitTypeLabel } from "@/lib/benefit";
import { isWithinWindow } from "@/lib/date";

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
  // 1층 태그는 나이·지역·상태·소득만 본다. 접수 기간이 지난 정책도 '가능성 있음'이
  // 되기 때문에, 기간은 태그와 별도로 알려 준다 (PRD F3-6 과 같은 사실을 1층에서도).
  const window = asOfISO
    ? isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd)
    : "within";
  // 정책이 요구하는 입력 항목의 사람이 읽는 라벨. 2층 질문과 같은 출처를 쓴다.
  const extraConditions = getRequiredQuestions([policy])
    .filter((q) => q.key !== "birthDate")
    .map((q) => q.label);

  return (
    <article
      className={
        dimmed
          ? "rounded-xl border border-ink-200 bg-sand-50 p-4"
          : "rounded-xl border border-ink-200 bg-white p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold leading-snug text-ink-900">
            {policy.name}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">{policy.agency}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${TAG_STYLE[result.tag]}`}
        >
          {result.tag}
        </span>
      </div>

      {/* 1층에서는 금액을 계산하지 않는다. 공고 문구를 그대로 인용한다. (PRD F0-9) */}
      <p className="mt-3 text-xs font-bold text-ink-500">
        {benefitTypeLabel(policy.benefitType)}
      </p>
      <p className="mt-0.5 text-sm font-bold text-ink-900">
        {policy.benefitSummary}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">
        공고 기준 상한이며, 실제 지원액은 심사에 따라 달라집니다.
      </p>

      {window === "after" && (
        <p className="mt-3 rounded-lg bg-sand-200 p-3 text-xs leading-relaxed text-ink-600">
          <strong className="text-ink-900">
            {policy.applicationEnd}에 접수가 끝났습니다.
          </strong>{" "}
          다음 모집 공고를 기다려야 합니다. 조건은 미리 확인해 두는 용도로 남겨
          둡니다.
        </p>
      )}

      {window === "before" && (
        <p className="mt-3 rounded-lg bg-sand-200 p-3 text-xs leading-relaxed text-ink-600">
          <strong className="text-ink-900">
            {policy.applicationStart}부터 접수합니다.
          </strong>{" "}
          아직 신청할 수 없습니다.
        </p>
      )}

      {result.tag === "해당 없음" && (
        <div className="mt-3 rounded-lg bg-white p-3">
          <p className="text-xs font-bold text-ink-600">이유</p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-ink-600">
            {result.failReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {result.tag === "확인 필요" && (
        <p className="mt-3 rounded-lg bg-warn-50 p-3 text-xs leading-relaxed text-warn-800">
          {result.unknownFields.join(" · ")}을(를) 답하지 않아 판단을
          보류했습니다.
        </p>
      )}

      {extraConditions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold text-ink-600">추가로 확인할 것</p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-ink-600">
            {extraConditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {policy.applicationStart} ~ {policy.applicationEnd ?? "상시"} · 확인{" "}
          {policy.verifiedAt ?? "미검수"}
        </p>
        <a
          href={policy.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white"
        >
          공식 페이지 →
        </a>
      </div>
    </article>
  );
}
