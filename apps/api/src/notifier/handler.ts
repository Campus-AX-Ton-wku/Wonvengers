import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import webpush from "web-push";
import { DynamoPushStore } from "../push-store";
import { DynamoUserDataStore } from "../store";
import { runNotifier, type NotifierDeps, type RunSummary } from "./run";
import { createSender } from "./sender";
import { fetchPublishedNotices, fetchPublishedPolicies } from "./source";

/**
 * 알림 Lambda 진입점. EventBridge 가 매시 정각(서울 9~21시) 빈 이벤트로 부른다.
 * 시연 · 시험 때 손으로: aws lambda invoke --payload '{"force":true}' (설계 "3. 시연 절차").
 * 환경변수는 infra/lib/perky-stack.ts 가 넣는다. 비밀 키는 SSM 에서 읽는다.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function parameter(ssm: SSMClient, name: string): Promise<string> {
  const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = out.Parameter?.Value?.trim();
  if (!value) throw new Error(`SSM ${name} is empty`);
  return value;
}

let deps: NotifierDeps | null = null;

async function liveDeps(): Promise<NotifierDeps> {
  const dynamo = new DynamoDBClient({});
  const ssm = new SSMClient({});
  const [publicKey, privateKey] = await Promise.all([
    parameter(ssm, required("VAPID_PUBLIC_KEY_PARAM")),
    parameter(ssm, required("VAPID_PRIVATE_KEY_PARAM")),
  ]);
  const policiesUrl = required("POLICIES_URL");
  return {
    push: new DynamoPushStore(dynamo, required("PUSH_TABLE_NAME")),
    users: new DynamoUserDataStore(dynamo, required("TABLE_NAME")),
    fetchPolicies: () => fetchPublishedPolicies(policiesUrl),
    // /notices.json 은 /policies.json 과 같은 앱에 있다 — 환경변수를 늘리지 않는다
    fetchNotices: () => fetchPublishedNotices(new URL("/notices.json", policiesUrl).toString()),
    send: createSender(webpush, { subject: required("VAPID_SUBJECT"), publicKey, privateKey }),
    now: () => new Date(),
  };
}

export async function handler(event?: { force?: unknown }): Promise<RunSummary> {
  deps ??= await liveDeps();
  const summary = await runNotifier(deps, { force: event?.force === true });
  // 숫자 요약만 남긴다 — 사용자 id · 답 · 구독 주소는 남기지 않는다
  console.log(JSON.stringify({ notifier: summary }));
  return summary;
}
