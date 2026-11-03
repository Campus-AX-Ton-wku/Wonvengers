import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  emptyContent,
  isEmptyContent,
  sameContent,
  sanitizeContent,
  validatePutRequest,
  validateUserData,
} from "../../web/lib/user-data";
import { validPayload } from "./fixtures";

describe("validatePutRequest — 서버가 다시 하는 형식 검사(신뢰 경계)", () => {
  it("올바른 본문을 통과시킨다", () => {
    const body = { data: validPayload(), baseUpdatedAt: null };
    expect(validatePutRequest(body)).toEqual({ ok: true, value: body });
  });

  it("맨 위의 알 수 없는 키를 거부한다 — 본문으로 사용자 ID 를 넘길 수 없다", () => {
    const result = validatePutRequest({ data: validPayload(), baseUpdatedAt: null, userId: "x" });
    expect(result).toEqual({ ok: false, error: "body.userId: unknown key" });
  });

  it("안쪽의 알 수 없는 키도 거부한다", () => {
    const data = validPayload();
    const values = { ...data.answers.values, age: 24 };
    const result = validatePutRequest({ data: { ...data, answers: { ...data.answers, values } }, baseUpdatedAt: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("body.data.answers.values.age: unknown key");
  });

  it("동의 문구 버전이 다르면 거부한다", () => {
    const result = validateUserData({ ...validPayload(), consentVersion: "2026-01-01" });
    expect(result).toEqual({ ok: false, error: "data.consentVersion: consent required" });
  });

  it("오류에는 경로만 담고 값은 담지 않는다", () => {
    const data = validPayload();
    const result = validateUserData({ ...data, listing: { ...data.listing, deposit: "삼백만원" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("data.listing.deposit: out of range");
      expect(result.error).not.toContain("삼백만원");
    }
  });

  it("계약 조건·자격 답·직접 답한 조건은 없어도(null) 된다", () => {
    const result = validateUserData({ ...validPayload(), listing: null, profile: null, declared: null });
    expect(result.ok).toBe(true);
  });

  it("아직 입력 중인 계약 시작일·생년월일(빈 문자열)은 받는다", () => {
    const data = validPayload();
    const result = validateUserData({
      ...data,
      listing: { ...data.listing!, contractStartDate: "" },
      profile: { ...data.profile!, values: { ...data.profile!.values, birthDate: "" } },
    });
    expect(result.ok).toBe(true);
  });

  it("'모름'과 숫자·예/아니오만 받는다", () => {
    const data = validPayload();
    const result = validateUserData({
      ...data,
      profile: { ...data.profile!, values: { ...data.profile!.values, hasNoHouse: "yes" } },
    });
    expect(result).toEqual({ ok: false, error: "data.profile.values.hasNoHouse: not a boolean" });
  });

  it("체크리스트 정책 id 형식과 개수를 본다", () => {
    expect(validateUserData({ ...validPayload(), checklists: { "../x": { eligibility: true, period: true, documents: true } } }).ok).toBe(false);
    const many = Object.fromEntries(
      Array.from({ length: 201 }, (_, i) => [`p-${i}`, { eligibility: false, period: false, documents: false }])
    );
    expect(validateUserData({ ...validPayload(), checklists: many })).toEqual({
      ok: false,
      error: "data.checklists: too many entries",
    });
  });

  it("__proto__ 같은 키로 객체 원형을 건드릴 수 없다", () => {
    const declared = JSON.parse('{"__proto__": true}') as Record<string, boolean>;
    expect(validateUserData({ ...validPayload(), declared }).ok).toBe(false);
  });

  it("baseUpdatedAt 은 null 이거나 시각이다", () => {
    expect(validatePutRequest({ data: validPayload(), baseUpdatedAt: "어제" }).ok).toBe(false);
    expect(validatePutRequest({ data: validPayload(), baseUpdatedAt: "2026-11-04T09:00:00.000Z" }).ok).toBe(true);
  });

  it("CONSENT_VERSION 은 설계의 날짜다", () => {
    expect(CONSENT_VERSION).toBe("2026-11-04");
  });
});

describe("sanitizeContent — 이 기기의 사본을 올릴 수 있게 다듬는다", () => {
  it("형식이 깨진 묶음만 버리고 나머지는 지킨다", () => {
    const data = validPayload();
    const content = sanitizeContent({
      answers: data.answers,
      listing: { ...data.listing, months: "열두 달" },
      profile: data.profile,
      declared: data.declared,
      checklists: data.checklists,
    });
    expect(content.listing).toBeNull();
    expect(content.answers).toEqual(data.answers);
    expect(content.profile).toEqual(data.profile);
  });

  it("빈 직접 답(declared {})은 null 로 본다", () => {
    const content = sanitizeContent({ ...emptyContent(), declared: {} });
    expect(content.declared).toBeNull();
  });
});

describe("isEmptyContent · sameContent", () => {
  it("아무 답도 없으면 비었다", () => {
    expect(isEmptyContent(emptyContent())).toBe(true);
    const data = validPayload();
    expect(isEmptyContent(data)).toBe(false);
  });

  it("키 순서가 달라도 같은 내용이면 같다 — 동의 시각·버전은 비교하지 않는다", () => {
    const a = validPayload();
    const b = JSON.parse(JSON.stringify({ ...a, consentAt: "2026-11-05T00:00:00.000Z" })) as typeof a;
    const reordered = { ...b, answers: { answeredKeys: b.answers.answeredKeys, values: b.answers.values } };
    expect(sameContent(a, reordered)).toBe(true);
    expect(sameContent(a, { ...a, listing: null })).toBe(false);
  });
});
