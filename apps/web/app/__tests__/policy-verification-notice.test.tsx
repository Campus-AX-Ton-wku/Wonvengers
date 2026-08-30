// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PolicyCard from "@/app/find/PolicyCard";
import type { PolicyMeta, TagResult } from "@/lib/types";

/**
 * 검수 여부 표시.
 *
 * 이 검증은 원래 find-policies.test.tsx 가 **실제 데이터에 미검수 정책이
 * 하나쯤 있다**는 전제로 하고 있었다 (익산형 청년월세가 verifiedAt: null 이었다).
 * 2026-08-30 에 그 정책을 검수하면서 전제가 깨졌고, 미검수 분기가 화면에
 * 어떻게 그려지는지 아무도 확인하지 않게 될 뻔했다.
 *
 * 그래서 데이터에 기대지 않고 카드에 직접 값을 넣어 두 분기를 모두 확인한다.
 * policies.json 이 앞으로 어떻게 바뀌든 이 검증은 계속 돈다.
 */

const 기본정책: PolicyMeta = {
  id: "test-policy",
  name: "테스트 지원금",
  agency: "테스트기관",
  regionScope: "전국",
  applicationStart: "2026-01-01",
  applicationEnd: "2026-12-31",
  benefitType: "rent_capped_monthly",
  benefitSummary: "월 최대 20만원",
  monthlyCap: 200000,
  maxMonths: 12,
  requiredInputs: [],
  exclusiveGroup: [],
  sourceUrl: "https://example.com/notice",
  applyUrl: "https://example.com/apply",
  youthPolicyNo: null,
  gov24ServiceId: null,
  verifiedAt: null,
  effectiveYear: 2026,
  notes: "",
  discovery: {
    ageMin: 19,
    ageMax: 34,
    regions: ["전국"],
    statuses: null,
    incomeBracketMin: null,
    incomeBracketMax: null,
  },
};

const 태그: TagResult = { tag: "가능성 있음", failReasons: [], unknownFields: [] };

function 카드를_그린다(verifiedAt: string | null) {
  render(<PolicyCard policy={{ ...기본정책, verifiedAt }} result={태그} asOfISO="2026-08-30" />);
}

describe("정책 카드의 검수 여부 표시", () => {
  it("검수한 정책은 대조한 날짜를 밝힌다", () => {
    카드를_그린다("2026-08-30");

    expect(screen.getByText("팀이 2026-08-30에 공고 원문과 대조했습니다.")).toBeTruthy();
  });

  it("검수 전 정책은 원문을 직접 확인하라고 경고한다", () => {
    카드를_그린다(null);

    expect(screen.getByText(/아직 공고 원문과 대조하지 않았습니다/)).toBeTruthy();
  });

  it("두 문구가 동시에 나오지 않는다 — 하나는 반드시 거짓이 된다", () => {
    카드를_그린다("2026-08-30");

    expect(screen.queryByText(/아직 공고 원문과 대조하지 않았습니다/)).toBeNull();
  });
});
