import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import {
  ALLOWED_ORIGINS,
  CALLBACK_URLS,
  DOMAIN_PREFIX,
  KAKAO_OIDC,
  LOGOUT_URLS,
  REGION,
  SSM_PARAMS,
  TABLE_NAME,
} from "./config";

/** 저장소 루트. Lambda 가 apps/api 와 apps/web/lib/user-data.ts 를 함께 묶으므로 묶기 기준이 루트다. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * infra 에 고정한 esbuild 의 패키지 폴더. CDK 는 묶기를 projectRoot(저장소 루트)에서
 * `npx --no-install esbuild` 로 돌리는데, 루트에는 package.json·node_modules 가 없어(워크스페이스를 두지 않는다)
 * npx 가 infra/node_modules 의 esbuild 를 못 찾는다. npx 는 로컬에 없으면 `{prefix}/bin` 을 보므로,
 * 묶기 때만 prefix 를 esbuild 패키지 폴더로 두어 `{esbuild}/bin/esbuild`(0.28.2)를 쓰게 한다.
 */
const ESBUILD_PKG_DIR = path.dirname(createRequire(import.meta.url).resolve("esbuild/package.json"));

/**
 * Perky 로그인·답 저장 (docs/기획/2026-11-04-카카오-로그인-설계.md "구조").
 *
 * Cognito(Lite) ─ 카카오 OIDC, HTTP API(JWT authorizer) → Lambda 하나 → DynamoDB 한 테이블.
 * 전부 서울. 사용자 데이터가 다른 리전에 생기지 않도록 리전을 고정한다.
 */
export class PerkyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    if (this.region !== REGION) {
      throw new Error(`PerkyStack 은 ${REGION} 에만 만든다 (지금: ${this.region})`);
    }

    // 비밀값은 배포 명령이 SSM 에서 읽어 넘긴다. 템플릿에는 Ref 만 남는다.
    const kakaoClientSecret = new CfnParameter(this, "KakaoClientSecret", {
      type: "String",
      noEcho: true,
      description: "SSM /perky/kakao/client-secret 의 값 (cdk deploy --parameters 로 넘긴다)",
    });
    const budgetEmail = new CfnParameter(this, "BudgetEmail", {
      type: "String",
      description: "예산 알림을 받을 메일 주소",
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "perky-users",
      featurePlan: cognito.FeaturePlan.LITE,
      // 가입은 카카오 연동으로만 생긴다. 아이디·비밀번호 가입은 열지 않는다.
      selfSignUpEnabled: false,
      accountRecovery: cognito.AccountRecovery.NONE,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const domain = userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: DOMAIN_PREFIX },
      managedLoginVersion: cognito.ManagedLoginVersion.CLASSIC_HOSTED_UI,
    });

    const kakao = new cognito.UserPoolIdentityProviderOidc(this, "Kakao", {
      userPool,
      name: "Kakao",
      clientId: ssm.StringParameter.valueForStringParameter(this, SSM_PARAMS.clientId),
      clientSecret: kakaoClientSecret.valueAsString,
      issuerUrl: KAKAO_OIDC.issuer,
      scopes: ["openid"],
      attributeRequestMethod: cognito.OidcAttributeRequestMethod.GET,
      endpoints: {
        authorization: KAKAO_OIDC.authorization,
        token: KAKAO_OIDC.token,
        userInfo: KAKAO_OIDC.userInfo,
        jwksUri: KAKAO_OIDC.jwks,
      },
      // 카카오 동의항목을 전부 껐다. 이름·이메일을 받지 않고 sub 만 쓴다.
      attributeMapping: { custom: { username: cognito.ProviderAttribute.other("sub") } },
    });

    const client = userPool.addClient("WebClient", {
      userPoolClientName: "perky-web",
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID],
        callbackUrls: CALLBACK_URLS,
        logoutUrls: LOGOUT_URLS,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.custom("Kakao")],
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });
    client.node.addDependency(kakao);

    const table = new dynamodb.Table(this, "UserData", {
      tableName: TABLE_NAME,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const fn = new NodejsFunction(this, "ApiFunction", {
      entry: path.join(REPO_ROOT, "apps/api/src/handler.ts"),
      handler: "handler",
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, "apps/api/package-lock.json"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
        KAKAO_ADMIN_KEY_PARAM: SSM_PARAMS.adminKey,
      },
      bundling: {
        format: OutputFormat.CJS,
        target: "node22",
        minify: true,
        sourceMap: false,
        // SDK 도 함께 묶는다 — lockfile 에 고정한 버전이 그대로 올라간다.
        externalModules: [],
        environment: { npm_config_prefix: ESBUILD_PKG_DIR },
      },
    });

    // 최소 권한 (설계 "보안"): 그 테이블의 세 동작, 그 풀의 두 동작, 그 파라미터 하나.
    table.grant(fn, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem");
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminGetUser", "cognito-idp:AdminDeleteUser"],
        resources: [userPool.userPoolArn],
      })
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          this.formatArn({ service: "ssm", resource: "parameter", resourceName: SSM_PARAMS.adminKey.slice(1) }),
        ],
      })
    );

    const api = new apigw.HttpApi(this, "Api", {
      apiName: "perky-api",
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: [...ALLOWED_ORIGINS],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.PUT, apigw.CorsHttpMethod.DELETE],
        allowHeaders: ["authorization", "content-type"],
        maxAge: Duration.hours(1),
      },
    });
    new apigw.HttpStage(this, "DefaultStage", {
      httpApi: api,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 },
    });

    const authorizer = new HttpUserPoolAuthorizer("Cognito", userPool, { userPoolClients: [client] });
    const integration = new HttpLambdaIntegration("ApiIntegration", fn);
    api.addRoutes({
      path: "/me/data",
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.PUT],
      integration,
      authorizer,
    });
    api.addRoutes({ path: "/me", methods: [apigw.HttpMethod.DELETE], integration, authorizer });

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "perky-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 1, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 50,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: budgetEmail.valueAsString }],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: budgetEmail.valueAsString }],
        },
      ],
    });

    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
    new CfnOutput(this, "CognitoDomain", { value: `${domain.domainName}.auth.${REGION}.amazoncognito.com` });
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "KakaoRedirectUri", { value: `${domain.baseUrl()}/oauth2/idpresponse` });
  }
}
