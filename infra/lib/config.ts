/**
 * 스택이 쓰는 고정 값. 설계 문서(docs/기획/2026-11-04-카카오-로그인-설계.md)의 값을 그대로 옮겼다.
 * 비밀값은 여기 두지 않는다 — SSM 파라미터 이름만.
 */
export const ACCOUNT = "448842988711";
export const REGION = "ap-northeast-2";

export const ALLOWED_ORIGINS = ["https://wonvengers.vercel.app", "http://localhost:3000"] as const;
export const CALLBACK_URLS = ALLOWED_ORIGINS.map((origin) => `${origin}/auth/callback`);
export const LOGOUT_URLS = ALLOWED_ORIGINS.map((origin) => `${origin}/`);

export const DOMAIN_PREFIX = "perky-wonvengers";
export const TABLE_NAME = "perky-user-data";

/** https://kauth.kakao.com/.well-known/openid-configuration (2026-11-04 연결 시험) */
export const KAKAO_OIDC = {
  issuer: "https://kauth.kakao.com",
  authorization: "https://kauth.kakao.com/oauth/authorize",
  token: "https://kauth.kakao.com/oauth/token",
  userInfo: "https://kapi.kakao.com/v1/oidc/userinfo",
  jwks: "https://kauth.kakao.com/.well-known/jwks.json",
} as const;

export const SSM_PARAMS = {
  clientId: "/perky/kakao/client-id",
  clientSecret: "/perky/kakao/client-secret",
  adminKey: "/perky/kakao/admin-key",
  /** 알림 서명(VAPID) — 공개 키는 String, 비밀 키는 SecureString. CLI 로 넣는다(Task 9) */
  vapidPublicKey: "/perky/push/vapid-public-key",
  vapidPrivateKey: "/perky/push/vapid-private-key",
} as const;

/** 새 정책 알림 (docs/기획/2026-11-16-새-정책-알림-설계.md) */
export const PUSH_TABLE_NAME = "perky-push";
export const SITE_ORIGIN = "https://wonvengers.vercel.app";
/** 알림 서버가 읽는 배포된 앱의 정책 목록 (apps/web/app/policies.json/route.ts) */
export const POLICIES_URL = `${SITE_ORIGIN}/policies.json`;
export const VAPID_SUBJECT = SITE_ORIGIN;
/** 매시 정각, 서울 9~21시 = UTC 0~12시 */
export const NOTIFY_CRON = "cron(0 0-12 * * ? *)";

/**
 * GitHub Actions 자동 배포 (OIDC — 접근 키를 GitHub 에 두지 않는다).
 * main 에 머지되면 .github/workflows/deploy-aws.yml 이 배포 환경(승인 필요)에서 이 역할을 빌려 cdk deploy 한다.
 */
export const GITHUB_REPO = "Campus-AX-Ton-wku/Wonvengers";
export const DEPLOY_ENVIRONMENT = "aws-production";
export const DEPLOY_ROLE_NAME = "perky-github-deploy";
export const GITHUB_OIDC = {
  issuer: "https://token.actions.githubusercontent.com",
  audience: "sts.amazonaws.com",
} as const;
/** cdk bootstrap 기본 qualifier — 배포 역할은 이 접두어의 CDK 역할(deploy · file-publishing · lookup …)만 빌린다 */
export const CDK_QUALIFIER = "hnb659fds";
