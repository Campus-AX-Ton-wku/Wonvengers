import Link from "next/link";
import type { DiscoveryCardStatus, PolicyMeta, TagResult } from "@/lib/types";
import { benefitCeiling } from "@/lib/benefit";
import { cardStatus } from "@/lib/discovery";
import { formatDotDate } from "@/lib/date";
import { CARD_STATUS_BADGE, Icon3D, SaveButton, StatusBadge } from "@/app/components";
import { ShieldCheck, TriangleAlert } from "@/app/components/icons";
import { verificationBadge } from "@/lib/verification";

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

/** 금색은 '지금 받을 수 있는 돈' 신호다. 신청할 수 없는 카드에 주면 잘못 안심시킨다. */
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
  // 확인 필요는 카드 셋째 층의 주황 한 줄('확인할 것 · …')이 따로 말한다 — 알약과 '확인 필요'를 두 번 말하지 않게(11/23).
  if (status === "확인 필요") return null;
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
  const badge = CARD_STATUS_BADGE[status];
  // 원문 대조가 된 정책에는 배지를 달지 않는다(모든 카드에 붙으면 신호가 안 된다).
  // 아직 대조하지 않은 정책에만 "원문 대조 전"을 단다 (lib/verification.ts).
  const unverified = !verificationBadge(policy)?.lastConfirmedAt;

  return (
    /*
     * 카드 전체가 하나의 링크다. 오른쪽 chevron 은 11/23 시안에서 뺐다 — ♡ 와 › 가
     * 나란히 있으면 누를 곳이 둘로 보인다.
     *
     * 11/17: 오른쪽 위 ♡ 찜 버튼은 링크 밖 형제라 누를 곳이 겹치지 않는다.
     *
     * 구분선을 두지 않는다. 지면(옅은 파랑) 위의 흰 카드는 여백만으로 나뉜다.
     */
    <div className="relative">
    <Link
      href={`/find/policies/${policy.id}`}
      className="press focus-ring flex flex-col gap-3.5 rounded-card bg-surface p-[18px] shadow-card"
    >
      {/* 1층: 정책 종류 그림 + 이름 · 기관. 오른쪽 위는 ♡ 자리(pr-9). '원문 대조 전'은 배지 대신 기관 옆 회색 글씨로(11/23 시안). */}
      <div className="flex items-center gap-3 pr-9">
        <Icon3D name={policy.icon} size={40} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-bold leading-snug text-ink-900">{policy.name}</h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-ink-500">
            {policy.agency}
            {unverified && (
              <>
                <span aria-hidden="true" className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-[3px] whitespace-nowrap">
                  <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                  원문 대조 전
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* 2층: 금액(카드에서 제일 큰 글씨) + 오른쪽 상태 알약. 색만으로 말하지 않는다 — 알약마다 아이콘. */}
      <div className="flex items-center justify-between gap-2.5">
        {/* tabular-nums 를 쓰지 않는다. 이 한글 폰트에서는 등폭 숫자가 눈에 띄게
            벌어져 '4 80만원' 처럼 읽힌다. */}
        <p
          className={`min-w-0 text-[22px] font-extrabold leading-tight ${
            받을수있나(status) ? "text-brand-900" : "text-ink-500"
          }`}
        >
          {ceiling ? ceiling.label : "금액 확인 필요"}
        </p>
        <StatusBadge tone={badge.tone} icon={badge.icon} size="md">
          {status}
        </StatusBadge>
      </div>

      {/* 3층: 확인할 것이 있을 때만 옅은 주황 한 줄 */}
      {status === "확인 필요" && result.unknownFields.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-control bg-warn-50 px-2.5 py-2 text-[13px] leading-snug text-warn-800">
          <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          <b className="font-bold">확인할 것</b>
          <span aria-hidden="true">·</span>
          <span className="min-w-0">{result.unknownFields.join(" · ")}</span>
        </p>
      )}
      {note && <p className="-mt-1.5 text-sm leading-relaxed text-ink-600">{note}</p>}
    </Link>
    <SaveButton policyId={policy.id} policyName={policy.name} className="absolute right-2 top-2" />
    </div>
  );
}
