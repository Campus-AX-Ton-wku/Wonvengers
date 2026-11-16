import { describe, expect, it } from "vitest";
import { composeMessage, isSendingHour, kst, matchPolicies, selectNewPolicies, type Match } from "../src/notifier/plan";
import type { DiscoveryAnswers } from "../../web/lib/types";
import { policy } from "./fixtures";

const answers = (over: Partial<DiscoveryAnswers> = {}): DiscoveryAnswers => ({
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생",
  incomeBracket: 1,
  housingType: "월세",
  ...over,
});

describe("서울 시각", () => {
  it("UTC 를 서울(+9)로 — 날짜와 시", () => {
    expect(kst(new Date("2026-11-16T15:30:00Z"))).toEqual({ date: "2026-11-17", hour: 0 });
    expect(kst(new Date("2026-11-16T00:00:00Z"))).toEqual({ date: "2026-11-16", hour: 9 });
  });

  it("보내는 시간은 서울 9시대 ~ 21시대", () => {
    expect(isSendingHour(new Date("2026-11-15T23:59:00Z"))).toBe(false); // 08:59
    expect(isSendingHour(new Date("2026-11-16T00:00:00Z"))).toBe(true); // 09:00
    expect(isSendingHour(new Date("2026-11-16T12:00:00Z"))).toBe(true); // 21:00
    expect(isSendingHour(new Date("2026-11-16T13:00:00Z"))).toBe(false); // 22:00
  });
});

describe("selectNewPolicies", () => {
  const a = policy({ id: "a" });
  const b = policy({ id: "b" });
  const closed = policy({ id: "closed", applicationEnd: "2026-11-15" });
  const lastDay = policy({ id: "last-day", applicationEnd: "2026-11-16" });

  it("이미 알린 것은 빼고 들어온 순서대로", () => {
    expect(selectNewPolicies([a, b], new Set(["a"]), "2026-11-16")).toEqual({ toSend: [b], toMark: ["b"] });
  });

  it("마감된 새 정책은 보내지 않고 '이미 알림'에만 넣는다 — 마감일 당일은 보낸다", () => {
    const out = selectNewPolicies([closed, lastDay], new Set(), "2026-11-16");
    expect(out.toSend.map((p) => p.id)).toEqual(["last-day"]);
    expect(out.toMark).toEqual(["closed", "last-day"]);
  });

  it("새 것이 없으면 둘 다 빈 배열", () => {
    expect(selectNewPolicies([a], new Set(["a"]), "2026-11-16")).toEqual({ toSend: [], toMark: [] });
  });
});

describe("matchPolicies — 앱과 같은 1층 판정", () => {
  it("지역을 답하지 않았으면 null (보내지 않음)", () => {
    expect(matchPolicies(answers({ region: null }), [policy({ id: "a" })], "2026-11-16")).toBeNull();
  });

  it("'해당 없음'은 뺀다", () => {
    const workersOnly = policy({ id: "w", discovery: { ...policy({ id: "x" }).discovery, statuses: ["재직"] } });
    expect(matchPolicies(answers(), [workersOnly], "2026-11-16")).toEqual([]);
  });

  it("'가능성 있음'을 먼저, 그다음 '확인 필요' — 같은 등급은 들어온 순서", () => {
    // filter.ts: 정책의 소득 상한이 비어 있으면(공고 확인 전) '모름' → '확인 필요'
    const unchecked = (id: string) => policy({ id, discovery: { ...policy({ id }).discovery, incomeBracketMax: null } });
    const out = matchPolicies(answers(), [unchecked("maybe1"), policy({ id: "sure1" }), unchecked("maybe2"), policy({ id: "sure2" })], "2026-11-16");
    expect(out?.map((m) => `${m.policy.id}:${m.tag}`)).toEqual([
      "sure1:가능성 있음",
      "sure2:가능성 있음",
      "maybe1:확인 필요",
      "maybe2:확인 필요",
    ]);
  });

  it("나이는 오늘(서울) 기준으로 계산한다", () => {
    const upTo23 = policy({ id: "u23", discovery: { ...policy({ id: "x" }).discovery, ageMax: 23 } });
    // 2002-11-17 생은 2026-11-16 에 23세, 2026-11-17 에 24세
    expect(matchPolicies(answers({ birthDate: "2002-11-17" }), [upTo23], "2026-11-16")).toHaveLength(1);
    expect(matchPolicies(answers({ birthDate: "2002-11-17" }), [upTo23], "2026-11-17")).toEqual([]);
  });
});

describe("composeMessage — 정해진 문구", () => {
  const m = (id: string, tag: Match["tag"]): Match => ({ policy: policy({ id, name: `이름${id}` }), tag });

  it("1건 · 가능성 있음", () => {
    expect(composeMessage([m("a", "가능성 있음")])).toEqual({
      title: "새 지원금이 올라왔어요",
      body: "이름a — 조건에 맞을 가능성이 있어요",
      url: "/find/policies/a",
      tag: "new-policy",
    });
  });

  it("1건 · 확인 필요", () => {
    expect(composeMessage([m("a", "확인 필요")])).toEqual({
      title: "새 지원금이 올라왔어요",
      body: "이름a — 받을 수도 있는 지원금이에요. 조건을 확인해 보세요",
      url: "/find/policies/a",
      tag: "new-policy",
    });
  });

  it("여러 건 — 첫 정책 이름 외 N-1건, 목록으로", () => {
    expect(composeMessage([m("a", "가능성 있음"), m("b", "확인 필요"), m("c", "확인 필요")])).toEqual({
      title: "새 지원금 3건이 올라왔어요",
      body: "이름a 외 2건 — 받을 수 있을지 확인해 보세요",
      url: "/find/policies",
      tag: "new-policy",
    });
  });

  it("0건이면 던진다 — 부르는 쪽이 걸러야 한다", () => {
    expect(() => composeMessage([])).toThrow();
  });
});
