import type { IncomeBracket, PolicyMeta, ResolvedAnswers, TagResult } from "./types";
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

export function groupPolicies(policies: PolicyMeta[], answers: ResolvedAnswers): DiscoveryGroups {
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
export function answerSummary(answers: ResolvedAnswers, brackets: IncomeBracket[]): string[] {
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
 * 후보를 '지금 신청할 수 있는 것'과 '이번 회차가 끝난 것'으로 가른다 (F3-6).
 *
 * 1층 태그는 나이·지역·상태·소득만 보므로 접수가 끝난 정책도 '가능성 있음' 이 된다.
 * 한 묶음으로 세면 "지금 받을 수 있는 게 3건" 으로 읽히는데 실제로는 2건이 마감일
 * 수 있다 — 헤드라인 숫자와 첫 카드가 본문보다 먼저 읽힌다. 정책 데이터의 첫 항목
 * (국토부 청년월세)이 하필 금액도 가장 크고 마감된 사업이라, 가장 크고 가장 위에
 * 있는 초록 카드가 못 받는 것이 됐다.
 *
 * 목록에서 지우지는 않는다. 다음 회차에 다시 열리는 사업이라 없애면 "그런 지원금이
 * 아예 없다"로 읽혀 또 다른 거짓이 된다. 숫자와 순서에서만 갈라 둔다.
 *
 * 접수 시작 전인 정책도 마감 쪽에 넣는다 — 지금 신청할 수 없다는 점은 같고, 왜
 * 못 하는지는 카드 본문이 따로 말해준다.
 */
export function splitByApplicationWindow(
  groups: DiscoveryGroups,
  asOfISO: string
): { 신청가능: TaggedPolicy[]; 마감: TaggedPolicy[] } {
  const 후보 = [...groups.가능, ...groups.확인];
  const 열려있나 = ({ policy }: TaggedPolicy) =>
    isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd) === "within";

  return {
    신청가능: 후보.filter(열려있나),
    마감: 후보.filter((t) => !열려있나(t)),
  };
}

/** 후보 중 지금 실제로 신청할 수 있는 건수. 분류 기준은 splitByApplicationWindow 하나뿐이다. */
export function applicationOpenCount(groups: DiscoveryGroups, asOfISO: string): number {
  return splitByApplicationWindow(groups, asOfISO).신청가능.length;
}
