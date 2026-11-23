import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SSMClient } from "@aws-sdk/client-ssm";
import { route, type Deps } from "./app";
import { CognitoAccounts } from "./cognito";
import type { ApiEvent, ApiResult } from "./http";
import { createKakaoUnlinker, ssmAdminKeyLoader } from "./kakao";
import { isKakaoUnlinkRoute, kakaoUnlinkWebhook, type WebhookDeps } from "./kakao-webhook";
import { logResult } from "./log";
import { DynamoPushStore } from "./push-store";
import { DynamoUserDataStore } from "./store";

/** Lambda 진입점. 환경변수는 infra/lib/perky-stack.ts 가 넣는다. 리전은 Lambda 의 AWS_REGION. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let deps: (Deps & WebhookDeps) | null = null;

function liveDeps(): Deps & WebhookDeps {
  const dynamo = new DynamoDBClient({});
  // 회원 탈퇴의 카카오 끊기와 연결 해제 웹훅의 요청 확인이 같은 어드민 키를 쓴다 — 한 번 읽어 함께 쓴다
  const adminKey = ssmAdminKeyLoader(new SSMClient({}), required("KAKAO_ADMIN_KEY_PARAM"));
  const store = new DynamoUserDataStore(dynamo, required("TABLE_NAME"));
  return {
    store,
    photos: store,
    push: new DynamoPushStore(dynamo, required("PUSH_TABLE_NAME")),
    accounts: new CognitoAccounts(new CognitoIdentityProviderClient({}), required("USER_POOL_ID")),
    kakao: createKakaoUnlinker(adminKey),
    kakaoAdminKey: adminKey,
    now: () => new Date(),
    log: logResult,
  };
}

export async function handler(event: ApiEvent): Promise<ApiResult> {
  deps ??= liveDeps();
  // 연결 해제 웹훅만 JWT 없이 온다(카카오 → Perky). 나머지 여덟 경로(11/23 사진 셋 추가)는 route 가 토큰 sub 로만 처리한다.
  return isKakaoUnlinkRoute(event.routeKey) ? kakaoUnlinkWebhook(event, deps) : route(event, deps);
}
