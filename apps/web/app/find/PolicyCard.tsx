import Link from "next/link";
import type { DiscoveryCardStatus, PolicyMeta, TagResult } from "@/lib/types";
import { benefitCeiling } from "@/lib/benefit";
import { cardStatus } from "@/lib/discovery";
import { formatDotDate } from "@/lib/date";
import { CARD_STATUS_BADGE, Icon3D, SaveButton, StatusBadge } from "@/app/components";
import { ChevronRight, ICON_MD, ShieldCheck } from "@/app/components/icons";
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
  if (status === "확인 필요") {
    return `${result.unknownFields.join(" · ")} 확인 필요`;
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
  const badge = CARD_STATUS_BADGE[status];
  // 원문 대조가 된 정책에는 배지를 달지 않는다(모든 카드에 붙으면 신호가 안 된다).
  // 아직 대조하지 않은 정책에만 "원문 대조 전"을 단다 (lib/verification.ts).
  const unverified = !verificationBadge(policy)?.lastConfirmedAt;

  return (
    /*
     * 카드 전체가 하나의 링크다. 오른쪽 chevron 은 그 사실을 눈으로 말할 뿐,
     * 따로 누를 수 있는 것이 아니다 — 같은 카드에 누를 곳이 둘이면 어디를 눌러야
     * 하는지 생각하게 된다.
     *
     * 11/17: 오른쪽 위 ♡ 찜 버튼은 링크 밖 형제라 누를 곳이 겹치지 않는다.
     *
     * 구분선을 두지 않는다. 지면(옅은 파랑) 위의 흰 카드는 여백만으로 나뉜다.
     */
    <div className="relative">
    <Link
      href={`/find/policies/${policy.id}`}
      className="focus-ring block rounded-card bg-surface py-5 pl-5 pr-14 shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      {/* 색만으로 상태를 말하지 않는다 — 배지마다 아이콘이 하나씩 붙는다. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={badge.tone} icon={badge.icon}>
          {status}
        </StatusBadge>
        {unverified && (
          <StatusBadge tone="neutral" icon={ShieldCheck}>
            원문 대조 전
          </StatusBadge>
        )}
      </div>

      {/* 정책 종류 그림 — 이름을 읽기 전에 무슨 지원인지 먼저 보이게(11/20). 금액 줄은 그림 아래 왼쪽 끝에서 시작한다. */}
      <div className="mt-2.5 flex items-center gap-3">
        <Icon3D name={policy.icon} size={40} />
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-ink-900">{policy.name}</h3>
          <p className="mt-0.5 text-sm text-ink-500">{policy.agency}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {/* tabular-nums 를 쓰지 않는다. 이 한글 폰트에서는 등폭 숫자가 눈에 띄게
            벌어져 '4 80만원' 처럼 읽힌다. */}
        <p
          className={`text-[22px] font-extrabold leading-tight ${
            받을수있나(status) ? "text-brand-900" : "text-ink-500"
          }`}
        >
          {ceiling ? ceiling.label : "금액 확인 필요"}
        </p>
        <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
      </div>

      {note && <p className="mt-2 text-sm leading-relaxed text-ink-600">{note}</p>}
    </Link>
    <SaveButton policyId={policy.id} policyName={policy.name} className="absolute right-2 top-2" />
    </div>
  );
}
