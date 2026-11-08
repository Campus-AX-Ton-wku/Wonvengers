import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  type CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Cognito 의 연동 사용자. 사용자 이름은 `kakao_…` 이고(연동 로그인에서 피할 수 없다),
 * 카카오 회원번호는 identities 속성(JSON 배열)의 userId 에 있다.
 * Admin API 는 연동 사용자를 sub 가 아니라 사용자 이름으로 찾는다.
 */
export interface AccountService {
  /** 토큰의 username 으로 찾고, 그 사용자의 sub 가 토큰 sub 와 같은지 다시 본다. */
  kakaoUserId(username: string, sub: string): Promise<string>;
  deleteUser(username: string): Promise<void>;
}

export function kakaoIdFromIdentities(raw: string | undefined): string {
  const list: unknown = JSON.parse(raw ?? "[]");
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null) continue;
      const { providerName, userId } = entry as Record<string, unknown>;
      if (providerName === "Kakao" && typeof userId === "string" && /^\d+$/.test(userId)) return userId;
    }
  }
  throw new Error("no Kakao identity");
}

export class CognitoAccounts implements AccountService {
  constructor(
    private readonly client: CognitoIdentityProviderClient,
    private readonly userPoolId: string
  ) {}

  async kakaoUserId(username: string, sub: string): Promise<string> {
    const out = await this.client.send(new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: username }));
    const attr = (name: string) => out.UserAttributes?.find((a) => a.Name === name)?.Value;
    if (attr("sub") !== sub) throw new Error("token sub does not match Cognito user");
    return kakaoIdFromIdentities(attr("identities"));
  }

  async deleteUser(username: string): Promise<void> {
    await this.client.send(new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: username }));
  }
}
