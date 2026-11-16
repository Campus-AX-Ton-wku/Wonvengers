import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION, SCHEMA_VERSION, contentOf, emptyContent, isEmptyContent, sanitizeContent, validateUserData,
} from "../user-data";

const payload = (over: Record<string, unknown> = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  consentVersion: CONSENT_VERSION,
  consentAt: "2026-11-17T00:00:00.000Z",
  ...emptyContent(),
  ...over,
});

describe("찜 · 서류 체크 칸 (11/17)", () => {
  it("빈 묶음에는 빈 찜 · 빈 서류 체크가 있다", () => {
    expect(emptyContent().saved).toEqual([]);
    expect(emptyContent().documentChecks).toEqual({});
  });

  it("두 칸이 없는 예전 저장도 통과하고 빈 값으로 읽힌다", () => {
    const { saved: _s, documentChecks: _d, ...old } = payload();
    const r = validateUserData(old);
    expect(r.ok && r.value.saved).toEqual([]);
    expect(r.ok && r.value.documentChecks).toEqual({});
  });

  it("올바른 값", () => {
    const r = validateUserData(payload({ saved: ["a-1", "b"], documentChecks: { "a-1": ["임대차계약서 사본"] } }));
    expect(r.ok).toBe(true);
  });

  it.each([
    ["찜이 배열 아님", { saved: "a" }, "data.saved"],
    ["찜 id 형식", { saved: ["A B"] }, "data.saved"],
    ["찜 중복", { saved: ["a", "a"] }, "data.saved"],
    ["찜 51건", { saved: Array.from({ length: 51 }, (_, i) => `p${i}`) }, "data.saved"],
    ["서류 체크가 객체 아님", { documentChecks: [] }, "data.documentChecks"],
    ["서류 체크 정책 id 형식", { documentChecks: { "A B": [] } }, "data.documentChecks"],
    ["서류 이름 61자", { documentChecks: { a: ["가".repeat(61)] } }, "data.documentChecks.a"],
    ["서류 이름 빈 글자", { documentChecks: { a: [""] } }, "data.documentChecks.a"],
    ["서류 16개", { documentChecks: { a: Array.from({ length: 16 }, (_, i) => `d${i}`) } }, "data.documentChecks.a"],
    ["서류 중복", { documentChecks: { a: ["x", "x"] } }, "data.documentChecks.a"],
  ])("거부: %s", (_label, over, path) => {
    const r = validateUserData(payload(over));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.startsWith(path)).toBe(true);
  });

  it("찜이나 서류 체크만 있어도 빈 묶음이 아니다", () => {
    expect(isEmptyContent({ ...emptyContent(), saved: ["a"] })).toBe(false);
    expect(isEmptyContent({ ...emptyContent(), documentChecks: { a: ["x"] } })).toBe(false);
  });

  it("contentOf · sanitizeContent 가 두 칸을 나른다 — 깨진 칸만 버린다", () => {
    const c = { ...emptyContent(), saved: ["a"], documentChecks: { a: ["x"] } };
    expect(contentOf(c).saved).toEqual(["a"]);
    expect(contentOf(c).documentChecks).toEqual({ a: ["x"] });
    const s = sanitizeContent({
      answers: c.answers, listing: null, profile: null, declared: null, checklists: {},
      saved: ["a", "A B"], documentChecks: { a: ["x"] },
    });
    expect(s.saved).toEqual([]);
    expect(s.documentChecks).toEqual({ a: ["x"] });
  });
});
