import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, loadAnswers } from "@/lib/storage";

// EMPTY_ANSWERS 의 형태는 answers-migration.test.ts 가 본다 (스키마 이전과 같이 봐야 한다).
// 여기는 window 가 없을 때 죽지 않는지만 본다.
describe("storage — 서버에서 실행될 때", () => {
  it("window 가 없는 환경(서버)에서 loadAnswers 는 빈 답변을 반환하고 오류를 내지 않는다", () => {
    // Next.js 는 화면을 서버에서 먼저 그린다. 그때 localStorage 가 없으므로
    // 이 함수가 오류를 던지면 화면 전체가 깨진다.
    expect(() => loadAnswers()).not.toThrow();
    expect(loadAnswers()).toEqual(EMPTY_ANSWERS);
  });
});
