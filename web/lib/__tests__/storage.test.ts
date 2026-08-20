import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";

describe("storage — 서버에서 실행될 때", () => {
  it("EMPTY_ANSWERS 는 4개 항목이 모두 null 이다", () => {
    expect(EMPTY_ANSWERS).toEqual({
      age: null,
      region: null,
      status: null,
      incomeBracket: null,
    });
  });

  it("window 가 없는 환경(서버)에서 loadAnswers 는 빈 답변을 반환하고 오류를 내지 않는다", () => {
    // Next.js 는 화면을 서버에서 먼저 그린다. 그때 localStorage 가 없으므로
    // 이 함수가 오류를 던지면 화면 전체가 깨진다.
    expect(() => loadAnswers()).not.toThrow();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
  });
});
