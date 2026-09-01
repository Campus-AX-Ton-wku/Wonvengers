import type {
  DiscoveryCardStatus,
  IncomeBracket,
  PolicyMeta,
  ResolvedAnswers,
  TagResult,
} from "./types";
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

/** 나이 · 지역 · 상태. 목록 상단 한 줄과 칩 목록이 같은 어휘를 쓰도록 한 곳에서 만든다. */
function answerParts(answers: ResolvedAnswers): string[] {
  const region = REGION_OPTIONS.find((o) => o.value === answers.region);
  return [
    answers.age === null ? "나이 모름" : `${answers.age}세`,
    region ? region.chipLabel : "지역 모름",
    answers.status ?? "상태 모름",
  ];
}

/** 목록 화면 상단 칩. 어떤 답변으로 나온 결과인지 보여준다. */
export function answerSummary(answers: ResolvedAnswers, brackets: IncomeBracket[]): string[] {
  const bracket = brackets.find((b) => b.bracket === answers.incomeBracket);
  return [...answerParts(answers), bracket ? bracket.label : "소득 모름"];
}

/**
 * 목록 화면 상단 한 줄 ("25세 · 익산시 · 대학생").
 *
 * 칩 네 개를 늘어놓으면 제목 바로 아래에 덩어리가 하나 더 생겨 건수와 첫 카드
 * 사이를 막는다. 소득 구간은 여기서 빼고 '조건 수정' 화면에서 확인하게 한다 —
 * 어떤 답으로 나온 결과인지 알아보는 데는 나이 · 지역 · 상태로 충분하다.
 */
export function answerLine(answers: ResolvedAnswers): string {
  return answerParts(answers).join(" · ");
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

/**
 * 카드에 붙는 상태.
 *
 * 태그(나이·지역·상태·소득 판정)와 접수 기간은 서로 다른 사실이라 예전에는 태그
 * 배지와 본문 문장으로 따로 나왔다. 그래서 마감된 사업에 '가능성 있음' 이 붙고,
 * 왜 지금 신청할 수 없는지는 아래 문장을 읽어야 알 수 있었다.
 *
 * 두 사실을 사용자가 다음에 할 행동 하나로 합친다. 판정 규칙은 그대로다 —
 * 여기서 새로 판정하지 않고 tagPolicy 와 isWithinWindow 의 결과를 옮길 뿐이다.
 *
 * 순서가 곧 의미다. 대상이 아니면 접수 기간은 볼 필요가 없고, 접수 기간 밖이면
 * 남은 조건을 확인해도 지금은 신청할 수 없다.
 */
export function cardStatus(
  policy: PolicyMeta,
  result: TagResult,
  asOfISO: string
): DiscoveryCardStatus {
  if (result.tag === "해당 없음") return "대상 아님";
  const window = isWithinWindow(asOfISO, policy.applicationStart, policy.applicationEnd);
  if (window === "after") return "접수 마감";
  if (window === "before") return "신청 예정";
  return result.tag === "확인 필요" ? "확인 필요" : "신청 가능";
}
