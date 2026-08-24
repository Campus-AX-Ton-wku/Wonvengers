import type { PolicyMeta, YouthCorroboration, YouthMatchState } from "@/lib/types";
import { betterApplyUrl, formatApplyPeriod } from "@/lib/youth-index";

/**
 * 온통청년(정부 청년정책 DB) 대조 표시.
 *
 * 앱의 정책 데이터는 팀이 공고를 보고 손으로 옮긴 값이다. 같은 정책이 정부 DB 에
 * 어떻게 등록되어 있는지 나란히 보여주면, 사용자가 "이 숫자를 믿어도 되나"를
 * 스스로 판단할 수 있다.
 *
 * 색은 판정 태그(가능성 있음/예상적용)와 다른 계열을 쓴다. 같은 색을 쓰면
 * "출처가 확인됐다"를 "내가 대상이다"로 읽는다. accent 는 금액 전용이라 쓰지 않는다.
 */

const BADGE_STYLE: Record<YouthMatchState, string> = {
  일치: "bg-brand-50 text-brand-900 border-brand-200",
  불일치: "bg-warn-50 text-warn-800 border-warn-200",
  미등록: "bg-sand-50 text-ink-600 border-ink-200",
};

const BADGE_LABEL: Record<YouthMatchState, string> = {
  일치: "✓ 온통청년 등록 확인",
  불일치: "온통청년 공고와 차이",
  미등록: "온통청년 미등록",
};

export function YouthBadge({ state }: { state: YouthMatchState }) {
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${BADGE_STYLE[state]}`}
    >
      {BADGE_LABEL[state]}
    </span>
  );
}

/** 토글 라벨에 쓸 요약 문구. 열지 않고도 안에 뭐가 있는지 알 수 있게 한다. */
export function youthSummaryLabel(youth: YouthCorroboration): string {
  if (youth.state === "미등록") return "온통청년 대조 · 등록 기록 없음";
  const n = youth.record?.mismatches.length ?? 0;
  return n > 0 ? `온통청년 대조 · 다른 항목 ${n}개` : "온통청년 대조 · 일치";
}

export function YouthDetails({
  policy,
  youth,
}: {
  policy: PolicyMeta;
  youth: YouthCorroboration;
}) {
  const record = youth.record;
  const period = formatApplyPeriod(record?.applyPeriod ?? null);
  const deeperUrl = betterApplyUrl(policy, record);

  if (youth.state === "미등록") {
    return (
      <div className="text-xs leading-relaxed text-ink-600">
        <p>
          정부 청년정책 DB(온통청년)에서 이 정책을 찾지 못했습니다. 앱에 적힌 조건은 팀이 공고를
          직접 옮긴 값이므로, 신청 전에 주관 기관에 확인하는 것이 안전합니다.
        </p>
        <p className="mt-1 text-[11px] text-ink-500">{youth.fetchedAt} 조회 기준</p>
      </div>
    );
  }

  return (
    <div className="text-xs text-ink-600">
      <dl className="flex flex-col gap-1">
        {record?.name && <Row label="등록 정책명" value={record.name} strong />}
        <Row label="신청기간" value={period ?? "공고에 미기재"} strong />
        {record !== null && record.supportScale > 0 && (
          <Row
            label="지원 규모"
            value={`${record.supportScale.toLocaleString()}명${
              record.firstComeFirstServed ? " · 선착순 (예산 소진 시 마감)" : ""
            }`}
          />
        )}
        {record?.lastModifiedAt && (
          <Row label="공고 수정일" value={record.lastModifiedAt.slice(0, 10)} />
        )}
      </dl>

      {youth.state === "불일치" && (
        <div className="mt-2 rounded-md bg-warn-50 p-2.5">
          <p className="text-xs font-bold text-warn-800">
            앱 데이터와 다른 항목 {record?.mismatches.length}개
          </p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-warn-800">
            {record?.mismatches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {/*
            어느 쪽을 믿어야 하는지는 앱 값이 검수를 거쳤는지에 달려 있다.
            검수를 마친 값이면 온통청년 등록이 갱신되지 않았을 가능성이 크고
            (실제로 전북 정착지원은 2025년 회차만 등록돼 있다),
            아직 검수 전이면 어느 쪽이 맞는지 사람이 확인해야 한다.
          */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-warn-800">
            {policy.verifiedAt
              ? `앱 값은 팀이 ${policy.verifiedAt}에 공고 원문으로 확인한 값입니다. 온통청년 등록이 아직 갱신되지 않았을 수 있으니, 신청 전에 공고를 한 번 더 확인하세요.`
              : "앱 값은 아직 공고 원문으로 확인하지 않았습니다. 어느 쪽이 맞는지 반드시 공고로 확인하세요."}
          </p>
        </div>
      )}

      <p className="mt-2 text-[11px] text-ink-500">
        판정과 금액은 앱의 정책 데이터로만 계산합니다. 위 대조 정보는 출처 확인용입니다.{" "}
        {youth.fetchedAt} 조회 기준
      </p>

      {deeperUrl && (
        <a
          href={deeperUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-semibold text-brand-700 underline"
        >
          온통청년 등록 신청 링크 →
        </a>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-ink-500">{label}</dt>
      <dd className={strong ? "font-semibold text-ink-900" : "text-ink-900"}>{value}</dd>
    </div>
  );
}
