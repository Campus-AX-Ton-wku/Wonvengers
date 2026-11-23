import { createHash } from "node:crypto";
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { PushSubscriptionBody } from "../../web/lib/push-subscription";

/**
 * 표 perky-push (docs/기획/2026-11-16-새-정책-알림-설계.md "DynamoDB perky-push").
 * 파티션 userId(Cognito sub) + 정렬 deviceId(구독 주소 해시). 사용자 × 기기마다 한 항목.
 * 알림 Lambda 의 '이미 알린 정책'은 userId = "__state__" 인 항목 하나에 둔다(sub 는 UUID 라 겹치지 않는다).
 */
export const STATE_USER = "__state__";
export const STATE_DEVICE = "announced";
/** 마감 알림을 마지막으로 돌린 서울 날짜 (11/20 마감 알림) — 같은 날 두 번 보내지 않게 */
export const STATE_REMINDED = "reminded";
/** 이미 알린 청약 공고 (11/22) — 새 정책의 announced 와 따로 둔다 */
export const STATE_NOTICES = "announced-notices";
export const MAX_DEVICES = 5;
/** 마지막 갱신 후 1년이 지나면 DynamoDB TTL 이 지운다. 계정 화면을 열 때마다 갱신된다. */
export const PUSH_TTL_SECONDS = 365 * 24 * 60 * 60;

export function deviceIdOf(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export interface StoredDevice extends PushSubscriptionBody {
  userId: string;
  deviceId: string;
  updatedAt: string;
}

export interface PushStore {
  /** 켜기 · 갱신. 다른 기기가 이미 MAX_DEVICES 대면 가장 오래된 것부터 지운다. */
  put(userId: string, sub: PushSubscriptionBody, now: Date): Promise<void>;
  /** 끄기 — 이 기기 하나. 없어도 조용히. */
  delete(userId: string, endpoint: string): Promise<void>;
  /** 탈퇴 — 그 사용자의 기기 전부. */
  deleteAll(userId: string): Promise<void>;
  /** 알림 Lambda — 모든 구독(상태 항목 제외). */
  listDevices(): Promise<StoredDevice[]>;
  /** 알림 Lambda — 끊긴 구독(404 · 410) 정리. */
  deleteDevice(userId: string, deviceId: string): Promise<void>;
  /** 이미 알린 정책 id. 상태 항목이 없으면(첫 실행) null. */
  getAnnounced(): Promise<Set<string> | null>;
  saveAnnounced(ids: ReadonlySet<string>, now: Date): Promise<void>;
  getAnnouncedNotices(): Promise<Set<string> | null>;
  saveAnnouncedNotices(ids: ReadonlySet<string>, now: Date): Promise<void>;
  /** 마감 알림을 마지막으로 돌린 서울 날짜(YYYY-MM-DD). 한 번도 안 돌렸으면 null. */
  getReminderDate(): Promise<string | null>;
  saveReminderDate(date: string, now: Date): Promise<void>;
}

export class DynamoPushStore implements PushStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, private readonly tableName: string) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  private async devicesOf(userId: string): Promise<{ deviceId: string; updatedAt?: string }[]> {
    const out = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
        ProjectionExpression: "deviceId, updatedAt",
      })
    );
    return (out.Items ?? []) as { deviceId: string; updatedAt?: string }[];
  }

  async put(userId: string, sub: PushSubscriptionBody, now: Date): Promise<void> {
    const deviceId = deviceIdOf(sub.endpoint);
    const others = (await this.devicesOf(userId)).filter((d) => d.deviceId !== deviceId);
    const overflow = others.length - (MAX_DEVICES - 1);
    if (overflow > 0) {
      const oldest = [...others].sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "")).slice(0, overflow);
      for (const d of oldest) await this.deleteDevice(userId, d.deviceId);
    }
    const iso = now.toISOString();
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId, deviceId },
        UpdateExpression:
          "SET #endpoint = :endpoint, #p256dh = :p256dh, #auth = :auth, #updatedAt = :now, #expiresAt = :expiresAt, #createdAt = if_not_exists(#createdAt, :now)",
        ExpressionAttributeNames: {
          "#endpoint": "endpoint",
          "#p256dh": "p256dh",
          "#auth": "auth",
          "#updatedAt": "updatedAt",
          "#expiresAt": "expiresAt",
          "#createdAt": "createdAt",
        },
        ExpressionAttributeValues: {
          ":endpoint": sub.endpoint,
          ":p256dh": sub.keys.p256dh,
          ":auth": sub.keys.auth,
          ":now": iso,
          ":expiresAt": Math.floor(now.getTime() / 1000) + PUSH_TTL_SECONDS,
        },
      })
    );
  }

  async delete(userId: string, endpoint: string): Promise<void> {
    await this.deleteDevice(userId, deviceIdOf(endpoint));
  }

  async deleteAll(userId: string): Promise<void> {
    for (const d of await this.devicesOf(userId)) await this.deleteDevice(userId, d.deviceId);
  }

  async deleteDevice(userId: string, deviceId: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { userId, deviceId } }));
  }

  async listDevices(): Promise<StoredDevice[]> {
    const devices: StoredDevice[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const out = await this.doc.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "userId <> :state",
          ExpressionAttributeValues: { ":state": STATE_USER },
          ...(start ? { ExclusiveStartKey: start } : {}),
        })
      );
      for (const item of out.Items ?? []) {
        devices.push({
          userId: String(item.userId),
          deviceId: String(item.deviceId),
          endpoint: String(item.endpoint),
          keys: { p256dh: String(item.p256dh), auth: String(item.auth) },
          updatedAt: String(item.updatedAt),
        });
      }
      start = out.LastEvaluatedKey;
    } while (start);
    return devices;
  }

  async getAnnounced(): Promise<Set<string> | null> {
    const out = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { userId: STATE_USER, deviceId: STATE_DEVICE }, ConsistentRead: true })
    );
    if (!out.Item) return null;
    const ids = out.Item.policyIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }

  async saveAnnounced(ids: ReadonlySet<string>, now: Date): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        // 문자열 집합(SS)은 비어 있을 수 없어서 배열(L)로 둔다
        Item: { userId: STATE_USER, deviceId: STATE_DEVICE, policyIds: [...ids].sort(), updatedAt: now.toISOString() },
      })
    );
  }

  async getReminderDate(): Promise<string | null> {
    const out = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { userId: STATE_USER, deviceId: STATE_REMINDED }, ConsistentRead: true })
    );
    const date = out.Item?.date;
    return typeof date === "string" ? date : null;
  }

  async saveReminderDate(date: string, now: Date): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { userId: STATE_USER, deviceId: STATE_REMINDED, date, updatedAt: now.toISOString() },
      })
    );
  }

  async getAnnouncedNotices(): Promise<Set<string> | null> {
    const out = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { userId: STATE_USER, deviceId: STATE_NOTICES }, ConsistentRead: true })
    );
    if (!out.Item) return null;
    const ids = out.Item.noticeIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }

  async saveAnnouncedNotices(ids: ReadonlySet<string>, now: Date): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { userId: STATE_USER, deviceId: STATE_NOTICES, noticeIds: [...ids].sort(), updatedAt: now.toISOString() },
      })
    );
  }
}
