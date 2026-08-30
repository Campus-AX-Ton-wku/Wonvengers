import { describe, expect, it } from "vitest";
import { withRetry } from "../retry.mjs";

/**
 * 2026-08-30 실행에서 온통청년이 정책 하나에만 HTTP 403 을 돌려줬다.
 * 재조회하니 200 이었다 — 5개 정책을 딜레이 없이 연달아 때려서 걸린
 * 일시적 제한이다.
 *
 * 재시도가 없으면 이 일시 오류가 보고서에 "대조 못 함"으로 찍히고,
 * 읽는 사람은 **정책번호가 매핑 안 된 것**으로 오해한다. 다음에 할 일이
 * 달라지므로(재실행 vs 번호 찾기) 이 둘은 구분돼야 한다.
 */
describe("withRetry", () => {
  it("일시적으로 실패해도 다시 시도해서 결과를 얻는다", async () => {
    let 시도 = 0;
    const 결과 = await withRetry(
      async () => {
        시도++;
        if (시도 < 3) throw new Error("HTTP 403");
        return "성공";
      },
      { attempts: 3, delayMs: 0 }
    );

    expect(결과).toBe("성공");
    expect(시도).toBe(3);
  });

  it("끝까지 실패하면 마지막 오류를 던진다 — 조용히 null 로 넘기지 않는다", async () => {
    let 시도 = 0;
    await expect(
      withRetry(
        async () => {
          시도++;
          throw new Error(`HTTP 500 (${시도}번째)`);
        },
        { attempts: 2, delayMs: 0 }
      )
    ).rejects.toThrow("HTTP 500 (2번째)");

    expect(시도).toBe(2);
  });

  it("처음부터 성공하면 더 부르지 않는다", async () => {
    let 시도 = 0;
    await withRetry(
      async () => {
        시도++;
        return "성공";
      },
      { attempts: 3, delayMs: 0 }
    );

    expect(시도).toBe(1);
  });
});
