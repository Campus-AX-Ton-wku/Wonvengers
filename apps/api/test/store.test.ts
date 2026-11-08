import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoUserDataStore, TTL_SECONDS } from "../src/store";
import type { UserDataPayload } from "../../web/lib/user-data";
import { A, validPayload } from "./fixtures";

const ddb = mockClient(DynamoDBDocumentClient);
const store = new DynamoUserDataStore(new DynamoDBClient({ region: "ap-northeast-2" }), "perky-user-data");
const now = new Date("2026-11-04T09:00:00.000Z");

beforeEach(() => ddb.reset());

describe("DynamoUserDataStore", () => {
  it("get 은 userId 키로 강한 일관성 읽기를 하고, 키·TTL 칸은 빼고 돌려준다", async () => {
    ddb.on(GetCommand).resolves({
      Item: { ...validPayload(), userId: A.sub, updatedAt: "2026-11-04T09:00:00.000Z", expiresAt: 1 },
    });
    const item = await store.get(A.sub);
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "perky-user-data",
      Key: { userId: A.sub },
      ConsistentRead: true,
    });
    expect(item).toEqual({ data: validPayload(), updatedAt: "2026-11-04T09:00:00.000Z" });
  });

  it("항목이 없으면 null", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await store.get(A.sub)).toBeNull();
  });

  it("처음 저장은 '항목이 없을 때만', TTL 은 1년 뒤", async () => {
    ddb.on(PutCommand).resolves({});
    const out = await store.put(A.sub, validPayload(), null, now);
    const input = ddb.commandCalls(PutCommand)[0].args[0].input;
    expect(out).toEqual({ ok: true, updatedAt: "2026-11-04T09:00:00.000Z" });
    expect(input.ConditionExpression).toBe("attribute_not_exists(userId)");
    expect(input.Item).toMatchObject({
      userId: A.sub,
      updatedAt: "2026-11-04T09:00:00.000Z",
      expiresAt: Math.floor(now.getTime() / 1000) + TTL_SECONDS,
    });
  });

  it("다음 저장은 '서버 시각이 baseUpdatedAt 일 때만'", async () => {
    ddb.on(PutCommand).resolves({});
    await store.put(A.sub, validPayload(), "2026-11-04T08:00:00.000Z", now);
    const input = ddb.commandCalls(PutCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBe("#updatedAt = :base");
    expect(input.ExpressionAttributeValues).toEqual({ ":base": "2026-11-04T08:00:00.000Z" });
  });

  it("data 안에 userId 가 섞여 와도 키는 인자로 받은 userId 다", async () => {
    ddb.on(PutCommand).resolves({});
    const sneaky = { ...validPayload(), userId: "someone-else" } as unknown as UserDataPayload;
    await store.put(A.sub, sneaky, null, now);
    expect(ddb.commandCalls(PutCommand)[0].args[0].input.Item?.userId).toBe(A.sub);
  });

  it("조건이 틀리면 conflict", async () => {
    ddb.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "failed", $metadata: {} }));
    expect(await store.put(A.sub, validPayload(), null, now)).toEqual({ ok: false, reason: "conflict" });
  });

  it("delete 는 userId 키 하나만 지운다", async () => {
    ddb.on(DeleteCommand).resolves({});
    await store.delete(A.sub);
    expect(ddb.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: "perky-user-data",
      Key: { userId: A.sub },
    });
  });
});
