import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoUserDataStore, TTL_SECONDS, photoKey } from "../src/store";
import {
  CONSENT_VERSION,
  PREVIOUS_CONSENT_VERSIONS,
  validatePutRequest,
  validateUserData,
} from "../../web/lib/user-data";
import { MAX_PHOTO_BYTES, base64Bytes, validatePhotoBody } from "../../web/lib/profile-photo-data";
import { A, validPayload } from "./fixtures";

/**
 * 프로필 사진도 계정에 (11/23 ggue) — 같은 표의 다른 항목 photo#<sub>, 형식 검사, 동의 버전 2026-11-23.
 * 경로(GET · PUT · DELETE /me/photo)는 test/app.test.ts.
 */

/** JPEG 머리(FF D8 FF E0) + 채움 → base64 */
export function jpeg(bytes = 1000): string {
  const buf = Buffer.alloc(bytes, 0x41);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf.toString("base64");
}
const AT = "2026-11-23T12:00:00.000Z";

describe("validatePhotoBody", () => {
  it("JPEG base64 와 고른 때를 받는다", () => {
    const body = { image: jpeg(), at: AT };
    expect(validatePhotoBody(body)).toEqual({ ok: true, value: body });
  });

  it("40KB 까지 받고, 넘으면 거부한다", () => {
    expect(base64Bytes(jpeg(MAX_PHOTO_BYTES))).toBe(MAX_PHOTO_BYTES);
    expect(validatePhotoBody({ image: jpeg(MAX_PHOTO_BYTES), at: AT }).ok).toBe(true);
    expect(validatePhotoBody({ image: jpeg(MAX_PHOTO_BYTES + 3), at: AT })).toEqual({ ok: false, error: "body.image: too large" });
  });

  it.each([
    ["PNG", { image: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString("base64"), at: AT }, "body.image: not a jpeg"],
    ["data: 머리말", { image: `data:image/jpeg;base64,${jpeg()}`, at: AT }, "body.image: not base64"],
    ["시각 아님", { image: jpeg(), at: "어제" }, "body.at: not a timestamp"],
    ["모르는 키", { image: jpeg(), at: AT, userId: "x" }, "body.userId: unknown key"],
  ])("%s 이면 거부한다 — 오류에 값은 담지 않는다", (_n, body, error) => {
    expect(validatePhotoBody(body)).toEqual({ ok: false, error });
  });
});

describe("동의 버전 2026-11-23 (프로필 사진 항목 추가)", () => {
  it("쓰기는 지금 버전만 — 예전 버전으로 저장하려면 다시 동의해야 한다", () => {
    expect(CONSENT_VERSION).toBe("2026-11-23");
    const old = { ...validPayload(), consentVersion: "2026-11-04" };
    expect(validatePutRequest({ data: old, baseUpdatedAt: null })).toEqual({
      ok: false,
      error: "body.data.consentVersion: consent required",
    });
  });

  it("읽기는 예전 버전도 받는다 — 안 받으면 버전을 올린 순간 모든 계정의 저장값을 못 불러온다", () => {
    expect(PREVIOUS_CONSENT_VERSIONS).toContain("2026-11-04");
    const r = validateUserData({ ...validPayload(), consentVersion: "2026-11-04" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.consentVersion).toBe(CONSENT_VERSION);
  });

  it("목록에 없는 버전은 읽기에서도 거부한다", () => {
    expect(validateUserData({ ...validPayload(), consentVersion: "2026-01-01" }).ok).toBe(false);
  });

  it("프로필 카드의 photoAt 은 없어도 되고, 있으면 시각이어야 한다", () => {
    const card = { icon: "rent", color: "blue", name: null, pinnedBadge: null };
    expect(validateUserData({ ...validPayload(), profileCard: card }).ok).toBe(true);
    const withPhoto = validateUserData({ ...validPayload(), profileCard: { ...card, photoAt: AT } });
    expect(withPhoto.ok && withPhoto.value.profileCard?.photoAt).toBe(AT);
    expect(validateUserData({ ...validPayload(), profileCard: { ...card, photoAt: "x" } }).ok).toBe(false);
  });
});

const ddb = mockClient(DynamoDBDocumentClient);
const store = new DynamoUserDataStore(new DynamoDBClient({ region: "ap-northeast-2" }), "perky-user-data");
beforeEach(() => ddb.reset());

describe("DynamoUserDataStore — 사진", () => {
  it("사진은 photo#<sub> 항목에 1년 TTL 로 덮어쓴다 — 답 항목(userId=sub)과 따로", async () => {
    const now = new Date(AT);
    await store.putPhoto(A.sub, { image: jpeg(), at: AT }, now);
    expect(ddb.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: "perky-user-data",
      Item: { image: jpeg(), at: AT, updatedAt: AT, expiresAt: Math.floor(now.getTime() / 1000) + TTL_SECONDS, userId: `photo#${A.sub}` },
    });
    expect(photoKey(A.sub)).not.toBe(A.sub);
  });

  it("받기는 photo#<sub> 를 읽고, 없으면 null", async () => {
    ddb.on(GetCommand).resolves({ Item: { userId: photoKey(A.sub), image: jpeg(), at: AT, expiresAt: 1 } });
    expect(await store.getPhoto(A.sub)).toEqual({ image: jpeg(), at: AT });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ userId: `photo#${A.sub}` });
    ddb.on(GetCommand).resolves({});
    expect(await store.getPhoto(A.sub)).toBeNull();
  });

  it("delete(탈퇴 · 카카오 연결 해제)는 답과 사진을 함께 지운다", async () => {
    await store.delete(A.sub);
    expect(ddb.commandCalls(DeleteCommand).map((c) => c.args[0].input.Key)).toEqual([
      { userId: A.sub },
      { userId: `photo#${A.sub}` },
    ]);
  });
});
