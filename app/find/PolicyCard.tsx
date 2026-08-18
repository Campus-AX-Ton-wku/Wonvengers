import type { Policy, TagResult } from "@/lib/types";

const TAG_STYLE: Record<TagResult["tag"], string> = {
  "가능성 있음": "bg-ok-50 text-ok-700 border-ok-200",
  "확인 필요": "bg-warn-50 text-warn-800 border-warn-200",
  "해당 없음": "bg-ink-100 text-ink-700 border-ink-200",
};

export default function PolicyCard({
  policy,
  result,
}: {
  policy: Policy;
  result: TagResult;
}) {
  const dimmed = result.tag === "해당 없음";

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
          {policy.tier === 2 && (
            <span className="mt-1 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
              계산 가능
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${TAG_STYLE[result.tag]}`}
        >
          {result.tag}
        </span>
      </div>

      {/* 1층에서는 금액을 계산하지 않는다. 공고 문구를 그대로 인용한다. (PRD F0-9) */}
      <p className="mt-3 text-xs font-bold text-ink-500">
        {policy.benefit_type}
      </p>
      <p className="mt-0.5 text-sm font-bold text-ink-900">
        {policy.benefit_summary}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">
        공고 기준 상한이며, 실제 지원액은 심사에 따라 달라집니다.
      </p>

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

      {policy.extra_conditions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold text-ink-600">추가로 확인할 것</p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-ink-600">
            {policy.extra_conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {policy.application_start} ~ {policy.application_end} · 확인{" "}
          {policy.verified_at}
        </p>
        <a
          href={policy.apply_url}
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
