import { describe, expect, it } from "vitest";
import policiesJson from "@/data/policies.json";
import loanJson from "@/data/loan-products.json";
import {
  VERIFICATION,
  verificationBadge,
  verificationMismatches,
  type VerificationSnapshot,
} from "@/lib/verification";
import type { LoanProductMeta, PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];
const loans = loanJson as LoanProductMeta[];
const items = [...policies, ...loans];

/**
 * 팀 검수 결과(data/verification.json)를 화면에 붙이는 규칙.
 *
 * 배지는 '이 화면 값이 원문과 맞다고 팀원이 확인했다'는 약속이다. 검수를 마치지 않았거나,
 * 화면 값이 검수한 값과 한 칸이라도 다르면 붙이지 않는다.
 */
describe("검수 결과 파일", () => {
  it("앱에 있는 정책 · 대출 상품마다 검수 기록이 있다 (Supabase 와 같은 범위)", () => {
    const missing = items.filter((x) => !VERIFICATION.policies[x.id]).map((x) => x.id);
    expect(missing).toEqual([]);
  });

  it("확인한 사람 이름은 들어 있지 않다 — 정식 앱에 공개되는 파일이다", () => {
    const text = JSON.stringify(VERIFICATION);
    for (const name of ["노찬영", "박민준"]) expect(text.includes(name), name).toBe(false);
  });

  /**
   * 지금 검수를 마쳤는데 화면 값과 다른 정책. 여기 뜨면 JSON 과 DB 중 하나를 원문에 맞춰 고치고
   * (값을 바꾸면 다시 검수), 결과 파일을 다시 뽑는다. 그 전까지 그 정책에는 배지가 붙지 않는다.
   */
  it("검수를 마친 정책 중 화면 값과 검수 값이 다른 것 — 배지를 붙이지 않는다", () => {
    const report = items
      .filter((x) => ["검수", "교차검수"].includes(VERIFICATION.policies[x.id]?.trustLevel ?? ""))
      .map((x) => ({ id: x.id, diff: verificationMismatches(x) ?? [] }))
      .filter((r) => r.diff.length > 0);
    for (const r of report) expect(verificationBadge(items.find((x) => x.id === r.id)!)).toBeNull();
    // 2026-11-15: 익산 전입 지원 2건은 앱에 넣으면서 요약 · 금액 · 신청 시작일 · 상태 · 소득 칸을 채웠는데
    // DB 는 아직 예전 값이다. DB 를 맞추고 다시 검수하면 이 목록이 비고 배지가 붙는다.
    expect(report.map((r) => r.id).sort()).toEqual(
      ["iksan-move-in-household-incentive", "iksan-move-in-student-support"].sort()
    );
  });
});

describe("verificationBadge", () => {
  const 정책 = policies.find((p) => p.id === "moland-youth-rent-support")!;
  const 스냅샷 = (over: Partial<VerificationSnapshot["policies"][string]>): VerificationSnapshot => ({
    ...VERIFICATION,
    policies: { [정책.id]: { ...VERIFICATION.policies[정책.id], ...over } },
  });

  it("검수를 마쳤고 값이 같으면 배지를 준다", () => {
    expect(verificationBadge(정책)?.label).toBe("원문 확인");
  });

  it("두 사람이 확인했으면 사람 수를 적는다", () => {
    const badge = verificationBadge(정책, 스냅샷({ trustLevel: "교차검수", confirmers: 2 }));
    expect(badge?.label).toBe("원문 확인 · 2명");
  });

  it.each(["미검수", "재확인 필요"] as const)("%s 이면 배지가 없다", (level) => {
    expect(verificationBadge(정책, 스냅샷({ trustLevel: level }))).toBeNull();
  });

  it("화면 값이 검수한 값과 다르면 배지가 없다 — 고친 값에 '확인됨'을 붙이지 않는다", () => {
    const 다른값 = 스냅샷({ values: { ...VERIFICATION.policies[정책.id].values, monthlyCap: 150000 } });
    expect(verificationMismatches(정책, 다른값)).toEqual(["monthlyCap"]);
    expect(verificationBadge(정책, 다른값)).toBeNull();
  });

  it("검수 기록이 없는 항목에는 배지가 없다", () => {
    expect(verificationBadge({ ...정책, id: "없는-정책" })).toBeNull();
  });

  it("대출 상품은 화면에 쓰는 요약 문구만 견준다", () => {
    const loan = loans.find((l) => l.id === "youth-btm-jeonse-loan")!;
    expect(verificationMismatches(loan)).toEqual([]);
    expect(verificationBadge(loan)?.label).toBe("원문 확인");
  });
});
