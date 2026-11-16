import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ACCOUNT, KAKAO_OIDC, NOTIFY_CRON, POLICIES_URL, PUSH_TABLE_NAME, REGION, SSM_PARAMS, TABLE_NAME, VAPID_SUBJECT } from "../lib/config";
import { PerkyStack } from "../lib/perky-stack";

/** 묶기(esbuild)는 건너뛴다 — 이 테스트는 템플릿만 본다. 실제 묶기는 `cdk synth` 가 한다. */
function app(): App {
  return new App({ context: { "aws:cdk:bundling-stacks": [] } });
}

function synth(region: string = REGION): Template {
  return Template.fromStack(new PerkyStack(app(), "PerkyStack", { env: { account: ACCOUNT, region } }));
}

const template = synth();
type Statement = { Action: string | string[]; Resource: unknown };

/** 그 역할(논리 id 앞부분)에 붙은 정책 문장. 함수가 둘이라 역할별로 본다. */
function statementsOf(rolePrefix: string): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy"))
    .filter((p) => JSON.stringify(p.Properties.Roles).includes(rolePrefix))
    .flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}
const actionsOf = (rolePrefix: string) => [...new Set(statementsOf(rolePrefix).flatMap((s) => [s.Action].flat()))].sort();

describe("리전 고정", () => {
  it("서울이 아니면 스택을 만들지 않는다", () => {
    expect(() => synth("us-east-1")).toThrow(/ap-northeast-2/);
  });

  it("리전을 정하지 않아도 만들지 않는다", () => {
    expect(() => new PerkyStack(app(), "NoEnv", {})).toThrow(/ap-northeast-2/);
  });

  it("Organizations·Identity Center 자원이 없다 (무료 플랜 자동 전환 방지)", () => {
    for (const type of [
      "AWS::Organizations::Organization",
      "AWS::Organizations::Account",
      "AWS::SSO::Instance",
      "AWS::SSO::PermissionSet",
    ]) {
      expect(Object.keys(template.findResources(type))).toHaveLength(0);
    }
  });
});

describe("Cognito — 카카오 OIDC", () => {
  it("User Pool 은 Lite 요금제다", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", { UserPoolTier: "LITE" });
  });

  it("카카오 IdP 는 시험에서 확인한 설정 그대로다", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
      ProviderName: "Kakao",
      ProviderType: "OIDC",
      ProviderDetails: Match.objectLike({
        attributes_request_method: "GET",
        authorize_scopes: "openid",
        oidc_issuer: KAKAO_OIDC.issuer,
        authorize_url: KAKAO_OIDC.authorization,
        token_url: KAKAO_OIDC.token,
        attributes_url: KAKAO_OIDC.userInfo,
        jwks_uri: KAKAO_OIDC.jwks,
        client_secret: { Ref: "KakaoClientSecret" },
      }),
      AttributeMapping: { username: "sub" },
    });
  });

  it("client secret 은 NoEcho 파라미터로만 들어온다 — 템플릿에 값이 없다", () => {
    template.hasParameter("KakaoClientSecret", { Type: "String", NoEcho: true });
  });

  it("앱 클라이언트: 비밀 없음, 코드 흐름, 콜백·로그아웃 주소는 둘뿐, 카카오만", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      AllowedOAuthFlows: ["code"],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthScopes: ["openid"],
      CallbackURLs: ["https://wonvengers.vercel.app/auth/callback", "http://localhost:3000/auth/callback"],
      LogoutURLs: ["https://wonvengers.vercel.app/", "http://localhost:3000/"],
      SupportedIdentityProviders: ["Kakao"],
    });
  });

  it("도메인 접두어와 클래식 Hosted UI", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: "perky-wonvengers",
      ManagedLoginVersion: 1,
    });
  });
});

describe("DynamoDB", () => {
  it("userId 하나로 나누고, PITR·TTL(expiresAt)을 켜고, 스택을 지워도 남긴다", () => {
    template.hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
      Properties: Match.objectLike({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
        PointInTimeRecoverySpecification: Match.objectLike({ PointInTimeRecoveryEnabled: true }),
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
        DeletionProtectionEnabled: true,
      }),
    });
  });
});

describe("HTTP API", () => {
  it("CORS 출처는 운영 주소와 localhost 둘뿐", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      ProtocolType: "HTTP",
      CorsConfiguration: {
        AllowOrigins: ["https://wonvengers.vercel.app", "http://localhost:3000"],
        AllowMethods: ["GET", "PUT", "DELETE"],
        AllowHeaders: ["authorization", "content-type"],
        MaxAge: 3600,
      },
    });
  });

  it("다섯 경로 모두 JWT authorizer 뒤에 있다", () => {
    const routes = Object.values(template.findResources("AWS::ApiGatewayV2::Route")).map(
      (r) => r.Properties as { RouteKey: string; AuthorizationType: string }
    );
    expect(routes.map((r) => r.RouteKey).sort()).toEqual([
      "DELETE /me",
      "DELETE /me/push",
      "GET /me/data",
      "PUT /me/data",
      "PUT /me/push",
    ]);
    for (const r of routes) expect(r.AuthorizationType).toBe("JWT");
  });

  it("authorizer 는 서울 User Pool 발급자와 앱 클라이언트 audience 를 검증한다", () => {
    const [authorizer] = Object.values(template.findResources("AWS::ApiGatewayV2::Authorizer"));
    const config = authorizer.Properties.JwtConfiguration as { Audience: unknown[]; Issuer: unknown };
    expect(authorizer.Properties.AuthorizerType).toBe("JWT");
    expect(JSON.stringify(config.Issuer)).toContain("https://cognito-idp.ap-northeast-2.amazonaws.com/");
    expect(config.Audience).toEqual([{ Ref: expect.stringMatching(/^UserPoolWebClient/) }]);
  });

  it("기본 스테이지에 요청 상한을 둔다", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      AutoDeploy: true,
      DefaultRouteSettings: { ThrottlingBurstLimit: 20, ThrottlingRateLimit: 10 },
    });
  });
});

describe("Lambda — 최소 권한", () => {
  it("API 함수 — Node 22 arm64, 환경변수에는 이름만(비밀값 없음)", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
      Environment: {
        Variables: {
          TABLE_NAME: Match.anyValue(),
          PUSH_TABLE_NAME: Match.anyValue(),
          USER_POOL_ID: Match.anyValue(),
          KAKAO_ADMIN_KEY_PARAM: SSM_PARAMS.adminKey,
        },
      },
    });
  });

  it("API 함수의 허용 동작 — 답 표 셋, 구독 표 셋(UpdateItem·Query·DeleteItem), Cognito 둘, SSM 하나", () => {
    expect(actionsOf("ApiFunctionServiceRole")).toEqual([
      "cognito-idp:AdminDeleteUser",
      "cognito-idp:AdminGetUser",
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
      "ssm:GetParameter",
    ]);
    const statements = statementsOf("ApiFunctionServiceRole");
    for (const s of statements) expect(JSON.stringify(s.Resource)).not.toContain('"*"');
    const resourceOf = (action: string) =>
      statements.filter((s) => [s.Action].flat().includes(action)).map((s) => JSON.stringify(s.Resource)).join(" ");
    expect(resourceOf("dynamodb:GetItem")).toMatch(/UserData[0-9A-F]+.*Arn/);
    expect(resourceOf("dynamodb:UpdateItem")).toMatch(/PushSubscriptions[0-9A-F]+.*Arn/);
    expect(resourceOf("dynamodb:UpdateItem")).not.toMatch(/UserData/);
    expect(resourceOf("cognito-idp:AdminGetUser")).toMatch(/UserPool[0-9A-F]+.*Arn/);
    expect(resourceOf("ssm:GetParameter")).toContain(":parameter/perky/kakao/admin-key");
  });

  it("알림 함수 — 60초, 환경변수에는 이름 · 주소만(비밀 키 없음)", () => {
    template.resourceCountIs("AWS::Lambda::Function", 2);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
      Timeout: 60,
      Environment: {
        Variables: {
          PUSH_TABLE_NAME: Match.anyValue(),
          TABLE_NAME: Match.anyValue(),
          POLICIES_URL,
          VAPID_SUBJECT,
          VAPID_PUBLIC_KEY_PARAM: SSM_PARAMS.vapidPublicKey,
          VAPID_PRIVATE_KEY_PARAM: SSM_PARAMS.vapidPrivateKey,
        },
      },
    });
  });

  it("알림 함수의 허용 동작 — 구독 표 넷, 답 표는 읽기만, VAPID 파라미터 둘", () => {
    expect(actionsOf("NotifierFunctionServiceRole")).toEqual([
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Scan",
      "ssm:GetParameter",
    ]);
    const statements = statementsOf("NotifierFunctionServiceRole");
    for (const s of statements) expect(JSON.stringify(s.Resource)).not.toContain('"*"');
    const userTable = statements.filter((s) => JSON.stringify(s.Resource).includes("UserData"));
    expect(userTable.flatMap((s) => [s.Action].flat())).toEqual(["dynamodb:GetItem"]);
    const ssm = JSON.stringify(statements.filter((s) => [s.Action].flat().includes("ssm:GetParameter")).map((s) => s.Resource));
    expect(ssm).toContain(":parameter/perky/push/vapid-public-key");
    expect(ssm).toContain(":parameter/perky/push/vapid-private-key");
    expect(ssm).not.toContain("kakao");
  });
});

describe("새 정책 알림", () => {
  it("구독 표 — userId + deviceId, 요청 단위 과금, TTL expiresAt", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: PUSH_TABLE_NAME,
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "deviceId", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    });
  });

  it("매시 정각, 서울 9~21시(UTC 0~12시)에 알림 함수를 부른다", () => {
    expect(NOTIFY_CRON).toBe("cron(0 0-12 * * ? *)");
    template.hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: NOTIFY_CRON,
      State: "ENABLED",
      Targets: [Match.objectLike({ Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^NotifierFunction"), "Arn"] } })],
    });
  });

  it("시연 때 손으로 부를 함수 이름을 내보낸다", () => {
    template.hasOutput("NotifierFunctionName", {});
  });

  it("알림 Lambda 는 자동 재시도를 하지 않는다 — 이미 보낸 알림이 또 가지 않게", () => {
    template.hasResourceProperties("AWS::Lambda::EventInvokeConfig", {
      MaximumRetryAttempts: 0,
      FunctionName: { Ref: Match.stringLikeRegexp("^NotifierFunction") },
    });
  });
});

describe("운영", () => {
  it("월 1달러 예산 알림이 있다", () => {
    template.resourceCountIs("AWS::Budgets::Budget", 1);
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetType: "COST", TimeUnit: "MONTHLY", BudgetLimit: { Amount: 1, Unit: "USD" } }),
    });
  });

  it("배포 뒤 웹·카카오 설정에 쓸 값을 내보낸다", () => {
    for (const name of ["UserPoolId", "UserPoolClientId", "CognitoDomain", "ApiUrl", "KakaoRedirectUri"]) {
      template.hasOutput(name, {});
    }
  });

  it("템플릿 스냅샷", () => {
    // 묶음 해시는 코드가 바뀔 때마다 달라진다. 구조만 고정한다.
    const json = JSON.stringify(template.toJSON()).replace(/[0-9a-f]{64}(\.zip)?/g, "ASSET_HASH");
    expect(JSON.parse(json)).toMatchSnapshot();
  });
});
