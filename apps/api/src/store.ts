import { ConditionalCheckFailedException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { UserDataPayload } from "../../web/lib/user-data";

/** 마지막 저장 후 1년이 지나면 DynamoDB TTL 이 지운다(설계 "데이터"). */
export const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface StoredItem {
  data: UserDataPayload;
  updatedAt: string;
}

export type PutOutcome = { ok: true; updatedAt: string } | { ok: false; reason: "conflict" };

export interface UserDataStore {
  get(userId: string): Promise<StoredItem | null>;
  /** baseUpdatedAt 이 null 이면 "항목이 없을 때만", 아니면 "서버 updatedAt 이 이 값일 때만" 쓴다. */
  put(userId: string, data: UserDataPayload, baseUpdatedAt: string | null, now: Date): Promise<PutOutcome>;
  delete(userId: string): Promise<void>;
}

const DATA_KEYS = [
  "schemaVersion",
  "answers",
  "listing",
  "profile",
  "declared",
  "checklists",
  "consentVersion",
  "consentAt",
] as const satisfies readonly (keyof UserDataPayload)[];

/** 테이블 perky-user-data, 파티션 키 userId(= Cognito sub) 하나. 사용자당 1항목. */
export class DynamoUserDataStore implements UserDataStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, private readonly tableName: string) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async get(userId: string): Promise<StoredItem | null> {
    const out = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { userId }, ConsistentRead: true })
    );
    const item = out.Item;
    if (!item) return null;
    const data = Object.fromEntries(DATA_KEYS.map((k) => [k, item[k]])) as unknown as UserDataPayload;
    return { data, updatedAt: String(item.updatedAt) };
  }

  async put(userId: string, data: UserDataPayload, baseUpdatedAt: string | null, now: Date): Promise<PutOutcome> {
    const updatedAt = now.toISOString();
    const expiresAt = Math.floor(now.getTime() / 1000) + TTL_SECONDS;
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          // userId 를 맨 뒤에 둔다 — data 에 무엇이 들어 있든 키는 토큰의 sub 다.
          Item: { ...data, updatedAt, expiresAt, userId },
          ...(baseUpdatedAt === null
            ? { ConditionExpression: "attribute_not_exists(userId)" }
            : {
                ConditionExpression: "#updatedAt = :base",
                ExpressionAttributeNames: { "#updatedAt": "updatedAt" },
                ExpressionAttributeValues: { ":base": baseUpdatedAt },
              }),
        })
      );
      return { ok: true, updatedAt };
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return { ok: false, reason: "conflict" };
      throw err;
    }
  }

  async delete(userId: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { userId } }));
  }
}
