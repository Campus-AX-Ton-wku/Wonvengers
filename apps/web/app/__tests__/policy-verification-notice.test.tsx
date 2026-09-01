// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceNotice } from "@/app/find/policies/[id]/PolicyDetail";

/**
 * 검수 여부 표시.
 *
 * 이 검증은 원래 find-policies.test.tsx 가 **실제 데이터에 미검수 정책이
 * 하나쯤 있다**는 전제로 하고 있었다 (익산형 청년월세가 verifiedAt: null 이었다).
 * 2026-08-30 에 그 정책을 검수하면서 전제가 깨졌고, 미검수 분기가 화면에
 * 어떻게 그려지는지 아무도 확인하지 않게 될 뻔했다.
 *
 * 그래서 데이터에 기대지 않고 값을 직접 넣어 두 분기를 모두 확인한다.
 * policies.json 이 앞으로 어떻게 바뀌든 이 검증은 계속 돈다.
 */

const 출처를_그린다 = (verifiedAt: string | null) =>
  render(<SourceNotice sourceUrl="https://example.com/notice" verifiedAt={verifiedAt} />);

describe("정책 상세의 검수 여부 표시", () => {
  it("검수한 정책은 대조한 날짜를 밝힌다", () => {
    출처를_그린다("2026-08-30");

    expect(screen.getByText("팀이 2026-08-30에 공고 원문과 대조했습니다.")).toBeTruthy();
  });

  it("검수 전 정책은 원문을 직접 확인하라고 경고한다", () => {
    출처를_그린다(null);

    expect(screen.getByText(/아직 공고 원문과 대조하지 않았습니다/)).toBeTruthy();
  });

  it("두 문구가 동시에 나오지 않는다 — 하나는 반드시 거짓이 된다", () => {
    출처를_그린다("2026-08-30");

    expect(screen.queryByText(/아직 공고 원문과 대조하지 않았습니다/)).toBeNull();
  });

  it("공고 원문으로 가는 길은 검수 여부와 상관없이 있다", () => {
    출처를_그린다(null);

    expect(screen.getByRole("link", { name: "공고 원문 →" }).getAttribute("href")).toBe(
      "https://example.com/notice"
    );
  });
});
