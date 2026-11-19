import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  UserNotFoundException,
  type CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Cognito 의 연동 사용자. 사용자 이름은 `Kakao_<회원번호>` 이고(연동 로그인에서 피할 수 없다. 대문자 K —
 * 11/20 list-users 로 확인, 예전 문서의 `kakao_…` 는 틀렸다),
 * 카카오 회원번호는 identities 속성(JSON 배열)의 userId 에 있다.
 * Admin API 는 연동 사용자를 sub 가 아니라 사용자 이름으로 찾는다.
 */
export interface AccountService {
  /** 토큰의 username 으로 찾고, 그 사용자의 sub 가 토큰 sub 와 같은지 다시 본다. */
  kakaoUserId(username: string, sub: string): Promise<string>;
  deleteUser(username: string): Promise<void>;
}

/** 카카오 연결 해제 웹훅이 쓰는 쪽 — 카카오가 알려 주는 건 회원번호뿐이다. */
export interface KakaoAccountLookup {
  /** 그 회원번호의 사용자. 없거나 identities 의 회원번호가 다르면 null. */
  findByKakaoId(kakaoUserId: string): Promise<{ username: string; sub: string } | null>;
  deleteUser(username: string): Promise<void>;
}

/** Cognito 가 연동 사용자에게 붙이는 이름 — IdP 이름(infra/lib/perky-stack.ts 의 "Kakao") + "_" + 회원번호 */
export const KAKAO_USERNAME_PREFIX = "Kakao_";

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

export class CognitoAccounts implements AccountService, KakaoAccountLookup {
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

  async findByKakaoId(kakaoUserId: string): Promise<{ username: string; sub: string } | null> {
    const username = `${KAKAO_USERNAME_PREFIX}${kakaoUserId}`;
    let out;
    try {
      out = await this.client.send(new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: username }));
    } catch (err) {
      if (err instanceof UserNotFoundException || (err as { name?: unknown })?.name === "UserNotFoundException") return null;
      throw err;
    }
    const attr = (name: string) => out.UserAttributes?.find((a) => a.Name === name)?.Value;
    const sub = attr("sub");
    let linked: string;
    try {
      linked = kakaoIdFromIdentities(attr("identities"));
    } catch {
      return null;
    }
    // 이름만 믿지 않는다 — 그 사용자에 연결된 카카오 회원번호가 웹훅이 말한 번호와 같을 때만
    if (!sub || linked !== kakaoUserId) return null;
    return { username, sub };
  }

  async deleteUser(username: string): Promise<void> {
    await this.client.send(new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: username }));
  }
}
