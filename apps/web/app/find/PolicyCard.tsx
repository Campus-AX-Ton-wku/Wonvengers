import Link from "next/link";
import type { DiscoveryCardStatus, PolicyMeta, TagResult } from "@/lib/types";
import { benefitCeiling } from "@/lib/benefit";
import { cardStatus } from "@/lib/discovery";
import { formatDotDate } from "@/lib/date";
import { ChevronRightIcon } from "@/app/icons";

/**
 * 1층 정책 카드 — 목록의 한 줄.
 *
 * 한 줄이 답하는 것은 네 가지뿐이다: 지금 신청할 수 있나(상태), 무슨 사업인가,
 * 누가 주나, 얼마인가. 나머지(공고 문구·요건·신청 기간·출처)는 카드를 눌러 들어가는
 * 상세 화면에 있다.
 *
 * 예전에는 그것들이 카드마다 '자세히 보기 · 확인할 항목 N개' 토글로 붙어 있었다.
 * 확인할 항목이 0개인 카드에도 토글이 달려 자리만 차지했고, 카드가 다섯 장이면
 * 목록이 토글 다섯 개로 끊겼다. 카드 전체를 누를 수 있게 하고 토글을 없앤다.
 *
 * 금액은 공고 상한이다. 1층은 계약 조건을 모르므로 개인별 예상액을 계산할 수 없다
 * (PRD F0-9). 라벨을 따로 붙이지 않고 상세 화면에서 밝힌다 — 목록에서 줄마다
 * '공고 상한' 을 반복하면 정작 금액이 작아진다.
 */

const STATUS_STYLE: Record<DiscoveryCardStatus, string> = {
  "신청 가능": "bg-ok-50 text-ok-700",
  "확인 필요": "bg-warn-50 text-warn-800",
  "신청 예정": "bg-brand-50 text-brand-800",
  "접수 마감": "bg-ink-100 text-ink-600",
  "대상 아님": "bg-ink-100 text-ink-600",
};

/** accent 는 '지금 받을 수 있는 돈' 신호다. 신청할 수 없는 카드에 주면 잘못 안심시킨다. */
const 받을수있나 = (status: DiscoveryCardStatus) =>
  status === "신청 가능" || status === "확인 필요";

/**
 * 상태마다 사용자가 다음에 할 일을 한 줄로 말한다. 없으면 줄 자체를 빼서 카드가
 * 짧게 끝난다 — 상태 배지만으로 충분한 카드에 설명을 덧붙이면 목록이 텍스트로 찬다.
 */
function statusNote(
  status: DiscoveryCardStatus,
  policy: PolicyMeta,
  result: TagResult
): string | null {
  if (status === "확인 필요") {
    return `${result.unknownFields.join(" · ")} 조건을 확인하면 받을 수 있는지 정확히 알려드려요.`;
  }
  if (status === "접수 마감" && policy.applicationEnd) {
    return `${formatDotDate(policy.applicationEnd)} 접수 마감`;
  }
  if (status === "신청 예정") {
    return `${formatDotDate(policy.applicationStart)}부터 접수`;
  }
  if (status === "대상 아님") return result.failReasons[0] ?? null;
  return null;
}

export default function PolicyCard({
  policy,
  result,
  asOfISO,
}: {
  policy: PolicyMeta;
  result: TagResult;
  /** 판정 기준일. 접수 기간이 상태에 들어가므로 반드시 있어야 한다. */
  asOfISO: string;
}) {
  const status = cardStatus(policy, result, asOfISO);
  const ceiling = benefitCeiling(policy);
  const note = statusNote(status, policy, result);

  return (
    /*
     * 카드 전체가 하나의 링크다. 오른쪽 chevron 은 그 사실을 눈으로 말할 뿐,
     * 따로 누를 수 있는 것이 아니다 — 같은 카드에 누를 곳이 둘이면 어디를 눌러야
     * 하는지 생각하게 된다.
     *
     * 구분선을 두지 않는다. 카드 사이는 부모의 여백(space-y)이 가른다.
     */
    <Link
      href={`/find/policies/${policy.id}`}
      className="block rounded-2xl px-4 py-5 transition-colors hover:bg-sand-50 active:bg-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      <span
        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}
      >
        {status}
      </span>

      {/* break-keep — 한글은 기본값이면 어절 중간에서 끊긴다 ('지원사 / 업'). */}
      <h3 className="mt-2 break-keep text-base font-bold leading-snug text-ink-900">
        {policy.name}
      </h3>
      <p className="mt-0.5 text-xs text-ink-500">{policy.agency}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        {/* tabular-nums 를 쓰지 않는다. 이 한글 폰트에서는 등폭 숫자가 눈에 띄게
            벌어져 '4 80만원' 처럼 읽힌다. */}
        <p
          className={`text-[22px] font-extrabold leading-tight ${
            받을수있나(status) ? "text-accent-600" : "text-ink-500"
          }`}
        >
          {ceiling ? ceiling.label : "금액 확인 필요"}
        </p>
        <ChevronRightIcon size={20} className="shrink-0 text-ink-200" />
      </div>

      {note && <p className="mt-2 break-keep text-xs leading-relaxed text-ink-600">{note}</p>}
    </Link>
  );
}
