import type { PolicyMeta, TagResult } from "@/lib/types";
import { getRequiredQuestions } from "@/lib/questions";
import { benefitCeiling, benefitTypeLabel } from "@/lib/benefit";
import { isWithinWindow } from "@/lib/date";
import { Disclosure, StatusBadge } from "@/app/components";
import type { BadgeTone } from "@/app/components";
import {
  CircleCheck,
  CircleSlash,
  Clock,
  ExternalLink,
  FileText,
  ICON_SM,
  ShieldCheck,
  TriangleAlert,
} from "@/app/components/icons";

/**
 * 1층 정책 카드.
 *
 * 목록의 목적은 "무엇을 받을 수 있고 최대 얼마짜리인가"를 한 화면에서 훑는 것이다.
 * 그래서 카드 위쪽에 태그·정책명·상한 금액만 두고, 공고 문구·확인 항목·신청 정보는
 * 토글 안으로 내렸다.
 *
 * 판정 이유(해당 없음·확인 필요)는 접지 않는다 — 왜 이 태그가 붙었는지는 태그와
 * 함께 읽혀야 한다 (PRD F0-5).
 *
 * 금액은 공고 상한이다. 1층은 계약 조건을 모르므로 개인별 예상액을 계산할 수 없고,
 * 그래서 '공고 상한'이라고 적어 2층의 예상액과 구분한다 (PRD F0-9).
 *
 * ── 구조를 바꿀 때 주의 ──
 * 테스트가 DOM 구조를 세 군데 짚는다 (app/__tests__/closed-policy-weight.test.tsx):
 *   · 루트는 <article>
 *   · '공고 상한' 라벨의 **바로 다음 형제**가 금액이다
 *   · 태그의 부모(카드 머리)의 **바로 다음 형제**가 기관·마감 줄이다
 * 사이에 래퍼를 끼우지 말 것.
 */

const TAG_TONE: Record<TagResult["tag"], BadgeTone> = {
  "가능성 있음": "ok",
  "확인 필요": "warn",
  "해당 없음": "neutral",
};

/**
 * 아이콘은 태그를 따라간다. 색만 상태를 따라간다.
 *
 * 마감 카드에서도 태그 문구는 '가능성 있음'이다 — 1층 태그는 나이·지역·상태·소득만
 * 보고 접수 기간은 따로 알려주는 것이 의도된 결정이다 (PRD F3-6). 그래서 색만
 * muted 로 빼고 아이콘은 태그의 것을 그대로 쓴다. muted 톤의 기본 아이콘(Ban)을
 * 두면 "🚫 가능성 있음" 이라는 자기모순이 된다.
 */
const TAG_ICON = {
  "가능성 있음": CircleCheck,
  "확인 필요": TriangleAlert,
  "해당 없음": CircleSlash,
} as const;

export default function PolicyCard({
  policy,
  result,
  asOfISO,
  tone = "plain",
}: {
  policy: PolicyMeta;
  result: TagResult;
  /** 판정 기준일. 없으면 접수 기간 안내를 그리지 않는다(서버 렌더링 시점). */
  asOfISO?: string;
  /** flat — '해당되지 않는 지원금' 묶음. 그림자를 빼서 무게를 낮춘다. */
  tone?: "plain" | "flat";
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
  const closed = window === "after";

  return (
    <article
      className={`rounded-card p-5 ${
        tone === "flat" ? "bg-ink-50" : "bg-surface shadow-card"
      } ${dimmed ? "opacity-90" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold leading-snug text-ink-900">{policy.name}</h3>

        {/*
          접수가 끝난 정책의 태그는 색을 잃는다. 초록은 "지금 받을 수 있다"는
          신호라, 못 받는 카드에 그 색이 붙으면 문구를 읽기 전에 이미 잘못
          안심시킨다. 색은 행동할 수 있는 상태에만 남긴다.
        */}
        <StatusBadge tone={closed ? "muted" : TAG_TONE[result.tag]} icon={TAG_ICON[result.tag]}>
          {result.tag}
        </StatusBadge>
      </div>

      <p className="mt-1.5 text-xs text-ink-500">
        {policy.agency} · {benefitTypeLabel(policy.benefitType).split(" · ")[0]}
        {/* 접수 기간은 태그가 보지 않는 사실이다(위 주석 참고). 태그·금액만 훑는
            사람에게는 아래 본문의 문장이 늦으므로 여기서 한 번 더 말한다. */}
        {closed && <span className="font-bold text-ink-700"> · 접수 마감</span>}
      </p>

      {ceiling && (
        /* 라벨 작게 위, 값 크게 아래. 금액을 오른쪽 구석에 작게 두면 목록을 훑을 때
           "무엇을 최대 얼마까지" 라는 질문에 답하지 못한다.
           마감된 정책의 금액에는 금색을 쓰지 않는다 — 금색은 '받을 수 있는 돈'
           신호라, 지금 신청할 수 없는 금액에 주면 가장 큰 혜택처럼 읽힌다. */
        <div className="mt-4">
          <p className="text-[11px] font-bold text-ink-500">공고 상한</p>
          {/* tabular-nums 를 쓰지 않는다. 자릿수를 세로로 맞출 표가 아니고, 이
              한글 폰트에서는 등폭 숫자가 눈에 띄게 벌어져 '4 80만원' 처럼 읽힌다. */}
          <p
            className={`mt-0.5 text-2xl font-extrabold leading-tight ${
              closed || dimmed ? "text-ink-500" : "text-accent-600"
            }`}
          >
            {ceiling.label}
          </p>
        </div>
      )}

      {/* 왜 이 태그인지는 접지 않는다. 태그만 보고는 이유를 알 수 없다. */}
      {result.tag === "해당 없음" && (
        <ul className="mt-3 flex flex-col gap-1 text-xs leading-relaxed text-ink-600">
          {result.failReasons.map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <span aria-hidden="true" className="text-ink-300">
                ·
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {result.tag === "확인 필요" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-warn-800">
          <TriangleAlert size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{result.unknownFields.join(" · ")}을(를) 답하지 않아 판단을 보류했습니다.</span>
        </p>
      )}

      {closed && (
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
          <Clock size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-bold text-ink-900">
              {policy.applicationEnd}에 접수가 끝났습니다.
            </strong>{" "}
            다음 모집 공고를 기다려야 합니다.
          </span>
        </p>
      )}

      {window === "before" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
          <Clock size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <strong className="font-bold text-ink-900">
            {policy.applicationStart}부터 접수합니다.
          </strong>
        </p>
      )}

      <Disclosure label={`자세히 보기 · 확인할 항목 ${extraConditions.length}개`} className="mt-4">
        <p className="text-xs font-bold text-ink-900">{policy.benefitSummary}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          공고 기준 상한이며, 실제 지원액은 심사에 따라 달라집니다.
        </p>

        {extraConditions.length > 0 && (
          <>
            <p className="mt-3 text-xs font-bold text-ink-600">추가로 확인할 것</p>
            <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-ink-600">
              {extraConditions.map((c) => (
                <li key={c} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-ink-300">
                    ·
                  </span>
                  <span>{c}</span>
                </li>
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
          <a
            href={policy.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control text-xs font-bold text-brand-700 underline transition-colors hover:text-brand-800"
          >
            <FileText size={ICON_SM - 2} aria-hidden="true" />
            공고 원문
          </a>
          {policy.verifiedAt ? (
            <p className="flex items-start gap-1.5 text-[11px] text-ink-500">
              <ShieldCheck size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>팀이 {policy.verifiedAt}에 공고 원문과 대조했습니다.</span>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[11px] font-bold text-warn-800">
              <TriangleAlert size={ICON_SM - 2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>아직 공고 원문과 대조하지 않았습니다. 신청 전에 원문을 직접 확인하세요.</span>
            </p>
          )}
        </div>

        <a
          href={policy.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-ink-900 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-800"
        >
          공식 페이지
          <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
        </a>
      </Disclosure>
    </article>
  );
}
