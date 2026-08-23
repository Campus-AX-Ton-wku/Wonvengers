import type { DiscoveryAnswers, IncomeBracket, PolicyMeta, TagResult } from "./types";
import { tagPolicy } from "./filter";
import { REGION_OPTIONS } from "./region";
import { isWithinWindow } from "./date";

/**
 * 1층(발견)에서 질문 화면과 목록 화면이 공유하는 계산.
 *
 * 질문 화면은 CTA 에 후보 건수만 보여주고, 목록 화면이 같은 분류로 카드를 그린다.
 * 두 화면이 각자 계산하면 CTA 의 건수와 목록의 건수가 어긋난다.
 */

export interface TaggedPolicy {
  policy: PolicyMeta;
  result: TagResult;
}

export interface DiscoveryGroups {
  가능: TaggedPolicy[];
  확인: TaggedPolicy[];
  해당없음: TaggedPolicy[];
}

export function groupPolicies(policies: PolicyMeta[], answers: DiscoveryAnswers): DiscoveryGroups {
  const tagged = policies.map((policy) => ({ policy, result: tagPolicy(policy, answers) }));
  return {
    가능: tagged.filter((t) => t.result.tag === "가능성 있음"),
    확인: tagged.filter((t) => t.result.tag === "확인 필요"),
    해당없음: tagged.filter((t) => t.result.tag === "해당 없음"),
  };
}

/** 목록으로 넘어가는 CTA 에 쓰는 건수. '해당 없음'은 세지 않는다. */
export function candidateCount(groups: DiscoveryGroups): number {
  return groups.가능.length + groups.확인.length;
}

/** 목록 화면 상단 칩. 어떤 답변으로 나온 결과인지 보여준다. */
export function answerSummary(answers: DiscoveryAnswers, brackets: IncomeBracket[]): string[] {
  const region = REGION_OPTIONS.find((o) => o.value === answers.region);
  const bracket = brackets.find((b) => b.bracket === answers.incomeBracket);
  return [
    answers.age === null ? "나이 모름" : `${answers.age}세`,
    region ? region.chipLabel : "지역 모름",
    answers.status ?? "상태 모름",
    bracket ? bracket.label : "소득 모름",
  ];
}

/**
 * 후보 중 지금 실제로 신청할 수 있는 건수 (F3-6 을 1층에서도).
 *
 * 1층 태그는 나이·지역·상태·소득만 보므로 접수가 끝난 정책도 '가능성 있음' 이 된다.
 * 건수만 크게 말하면 "지금 신청할 수 있는 게 3건" 으로 읽히는데 실제로는 2건이
 * 마감일 수 있다 — 헤드라인 숫자가 카드보다 먼저 읽히기 때문에 나눠서 센다.
 */
export function applicationOpenCount(groups: DiscoveryGroups, asOfISO: string): number {
  return [...groups.가능, ...groups.확인].filter(
    ({ policy }) =>
      isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd) === "within"
  ).length;
}
