import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoPushStore, MAX_DEVICES, PUSH_TTL_SECONDS, STATE_DEVICE, STATE_USER, deviceIdOf } from "../src/push-store";
import { A } from "./fixtures";

const ddb = mockClient(DynamoDBDocumentClient);
const store = new DynamoPushStore(new DynamoDBClient({ region: "ap-northeast-2" }), "perky-push");
const now = new Date("2026-11-16T09:00:00.000Z");
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

beforeEach(() => ddb.reset());

describe("deviceIdOf", () => {
  it("구독 주소의 sha256 앞 32자 — 같은 주소면 같은 값", () => {
    expect(deviceIdOf("https://push.example/1")).toMatch(/^[0-9a-f]{32}$/);
    expect(deviceIdOf("https://push.example/1")).toBe(deviceIdOf("https://push.example/1"));
    expect(deviceIdOf("https://push.example/1")).not.toBe(deviceIdOf("https://push.example/2"));
  });
});

describe("put — 켜기", () => {
  it("userId + deviceId 키로 쓰고, createdAt 은 처음 한 번만, TTL 은 1년 뒤", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    ddb.on(UpdateCommand).resolves({});
    await store.put(A.sub, sub(1), now);
    const input = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.TableName).toBe("perky-push");
    expect(input.Key).toEqual({ userId: A.sub, deviceId: deviceIdOf(sub(1).endpoint) });
    expect(input.UpdateExpression).toContain("if_not_exists(#createdAt, :now)");
    expect(input.ExpressionAttributeValues).toMatchObject({
      ":endpoint": sub(1).endpoint,
      ":p256dh": "p1",
      ":auth": "a1",
      ":now": "2026-11-16T09:00:00.000Z",
      ":expiresAt": Math.floor(now.getTime() / 1000) + PUSH_TTL_SECONDS,
    });
  });

  it(`다른 기기가 이미 ${MAX_DEVICES}대면 가장 오래된 것부터 지운다`, async () => {
    const others = [5, 3, 1, 4, 2].map((n) => ({ deviceId: `d${n}`, updatedAt: `2026-11-0${n}T00:00:00.000Z` }));
    ddb.on(QueryCommand).resolves({ Items: others });
    ddb.on(DeleteCommand).resolves({});
    ddb.on(UpdateCommand).resolves({});
    await store.put(A.sub, sub(9), now);
    expect(ddb.commandCalls(DeleteCommand).map((c) => c.args[0].input.Key)).toEqual([{ userId: A.sub, deviceId: "d1" }]);
  });

  it("같은 기기를 다시 켜면 아무것도 지우지 않는다", async () => {
    const mine = { deviceId: deviceIdOf(sub(1).endpoint), updatedAt: "2026-11-01T00:00:00.000Z" };
    const others = [2, 3, 4, 5].map((n) => ({ deviceId: `d${n}`, updatedAt: `2026-11-0${n}T00:00:00.000Z` }));
    ddb.on(QueryCommand).resolves({ Items: [mine, ...others] });
    ddb.on(UpdateCommand).resolves({});
    await store.put(A.sub, sub(1), now);
    expect(ddb.commandCalls(DeleteCommand)).toHaveLength(0);
  });
});

describe("delete · deleteAll · deleteDevice", () => {
  it("끄기는 그 기기 하나만", async () => {
    ddb.on(DeleteCommand).resolves({});
    await store.delete(A.sub, sub(1).endpoint);
    expect(ddb.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: "perky-push",
      Key: { userId: A.sub, deviceId: deviceIdOf(sub(1).endpoint) },
    });
  });

  it("탈퇴는 그 사용자의 기기 전부", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ deviceId: "d1" }, { deviceId: "d2" }] });
    ddb.on(DeleteCommand).resolves({});
    await store.deleteAll(A.sub);
    expect(ddb.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": A.sub },
    });
    expect(ddb.commandCalls(DeleteCommand).map((c) => c.args[0].input.Key?.deviceId)).toEqual(["d1", "d2"]);
  });
});

describe("listDevices — 알림 Lambda", () => {
  it("상태 항목은 빼고, 여러 쪽을 이어 읽는다", async () => {
    const item = (n: number) => ({
      userId: `u${n}`,
      deviceId: `d${n}`,
      endpoint: `https://push.example/${n}`,
      p256dh: `p${n}`,
      auth: `a${n}`,
      updatedAt: "2026-11-16T00:00:00.000Z",
    });
    ddb
      .on(ScanCommand)
      .resolvesOnce({ Items: [item(1)], LastEvaluatedKey: { userId: "u1", deviceId: "d1" } })
      .resolvesOnce({ Items: [item(2)] });
    const devices = await store.listDevices();
    expect(devices).toEqual([
      { userId: "u1", deviceId: "d1", endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" }, updatedAt: "2026-11-16T00:00:00.000Z" },
      { userId: "u2", deviceId: "d2", endpoint: "https://push.example/2", keys: { p256dh: "p2", auth: "a2" }, updatedAt: "2026-11-16T00:00:00.000Z" },
    ]);
    const first = ddb.commandCalls(ScanCommand)[0].args[0].input;
    expect(first.FilterExpression).toBe("userId <> :state");
    expect(first.ExpressionAttributeValues).toEqual({ ":state": STATE_USER });
    expect(ddb.commandCalls(ScanCommand)[1].args[0].input.ExclusiveStartKey).toEqual({ userId: "u1", deviceId: "d1" });
  });
});

describe("이미 알린 정책 (상태 항목)", () => {
  it("없으면 null — 첫 실행", async () => {
    ddb.on(GetCommand).resolves({});
    expect(await store.getAnnounced()).toBeNull();
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "perky-push",
      Key: { userId: STATE_USER, deviceId: STATE_DEVICE },
      ConsistentRead: true,
    });
  });

  it("목록을 Set 으로", async () => {
    ddb.on(GetCommand).resolves({ Item: { userId: STATE_USER, deviceId: STATE_DEVICE, policyIds: ["a", "b"] } });
    expect(await store.getAnnounced()).toEqual(new Set(["a", "b"]));
  });

  it("저장은 정렬한 배열 (빈 목록도 저장된다)", async () => {
    ddb.on(PutCommand).resolves({});
    await store.saveAnnounced(new Set(["b", "a"]), now);
    expect(ddb.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: "perky-push",
      Item: { userId: STATE_USER, deviceId: STATE_DEVICE, policyIds: ["a", "b"], updatedAt: "2026-11-16T09:00:00.000Z" },
    });
  });
});
