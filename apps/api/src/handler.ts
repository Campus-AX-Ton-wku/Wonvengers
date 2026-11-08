import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SSMClient } from "@aws-sdk/client-ssm";
import { route, type Deps } from "./app";
import { CognitoAccounts } from "./cognito";
import type { ApiEvent, ApiResult } from "./http";
import { createKakaoUnlinker, ssmAdminKeyLoader } from "./kakao";
import { logResult } from "./log";
import { DynamoUserDataStore } from "./store";

/** Lambda 진입점. 환경변수는 infra/lib/perky-stack.ts 가 넣는다. 리전은 Lambda 의 AWS_REGION. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let deps: Deps | null = null;

function liveDeps(): Deps {
  return {
    store: new DynamoUserDataStore(new DynamoDBClient({}), required("TABLE_NAME")),
    accounts: new CognitoAccounts(new CognitoIdentityProviderClient({}), required("USER_POOL_ID")),
    kakao: createKakaoUnlinker(ssmAdminKeyLoader(new SSMClient({}), required("KAKAO_ADMIN_KEY_PARAM"))),
    now: () => new Date(),
    log: logResult,
  };
}

export async function handler(event: ApiEvent): Promise<ApiResult> {
  deps ??= liveDeps();
  return route(event, deps);
}
