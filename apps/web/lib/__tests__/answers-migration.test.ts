// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "@/lib/storage";

const ANSWERS_KEY = "perky.answers";

/**
 * 1층 답변이 나이(숫자)에서 생년월일로 바뀌었다.
 *
 * 이미 답한 사람의 브라우저에는 { age: 27 } 이 남아 있다. 생일을 모르는 채로
 * 생년월일을 만들어내면(1월 1일 등) 2층 판정까지 그 거짓 날짜를 쓰게 된다 —
 * 나이 요건이 걸린 정책에서 실제로 결과가 갈린다. 그래서 지어내지 않고 버린다.
 */
describe("나이 → 생년월일 스키마 이전", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("EMPTY_ANSWERS 는 나이 대신 생년월일을 가진다", () => {
    expect(EMPTY_ANSWERS).toEqual({
      birthDate: null,
      region: null,
      status: null,
      incomeBracket: null,
      housingType: null,
    });
  });

  it("옛 답변의 age 는 버린다 — 생일을 모르니 생년월일을 지어낼 수 없다", () => {
    window.localStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({ age: 27, region: "전북특별자치도 익산시", status: "재직", incomeBracket: 2 })
    );

    const 답변 = loadAnswers();

    expect(답변.birthDate).toBeNull();
    expect(답변).not.toHaveProperty("age");
  });

  it("옛 답변에서 나이 말고 다른 답은 살린다 — 세 질문을 다시 묻지 않는다", () => {
    window.localStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({ age: 27, region: "전북특별자치도 익산시", status: "재직", incomeBracket: 2 })
    );

    const 답변 = loadAnswers();

    expect(답변.region).toBe("전북특별자치도 익산시");
    expect(답변.status).toBe("재직");
    expect(답변.incomeBracket).toBe(2);
  });

  it("생년월일로 저장한 답변은 그대로 다시 읽힌다", () => {
    saveAnswers({
      birthDate: "1998-03-14",
      region: "전북특별자치도 익산시",
      status: "재직",
      incomeBracket: 2,
      housingType: null,
    });

    expect(loadAnswers().birthDate).toBe("1998-03-14");
  });
});
