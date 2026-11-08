import { GetParameterCommand, type SSMClient } from "@aws-sdk/client-ssm";

export const KAKAO_UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";
/** 앱에 연결되지 않은 사용자(이미 끊김). 탈퇴를 다시 시도할 때 나온다 — 성공으로 본다. */
export const KAKAO_NOT_REGISTERED = -101;

export class KakaoUnlinkError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined
  ) {
    super(`kakao unlink failed: ${status} ${code ?? ""}`);
    this.name = "KakaoUnlinkError";
  }
}

/**
 * Admin 키로 연결을 끊는다. 앱은 Cognito 를 거쳐 로그인해서 카카오 사용자 토큰이 없다.
 * Admin 키는 모든 사용자에 대한 권한이라 Lambda 안에서만 쓴다(SSM SecureString).
 */
export async function unlinkKakaoUser(
  kakaoUserId: string,
  adminKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<"unlinked" | "already"> {
  const res = await fetchImpl(KAKAO_UNLINK_URL, {
    method: "POST",
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({ target_id_type: "user_id", target_id: kakaoUserId }).toString(),
  });
  if (res.ok) return "unlinked";
  let code: number | undefined;
  try {
    const body = (await res.json()) as { code?: unknown };
    code = typeof body.code === "number" ? body.code : undefined;
  } catch {
    code = undefined;
  }
  if (code === KAKAO_NOT_REGISTERED) return "already";
  throw new KakaoUnlinkError(res.status, code);
}

export interface KakaoUnlinker {
  unlink(kakaoUserId: string): Promise<"unlinked" | "already">;
}

export function createKakaoUnlinker(
  loadAdminKey: () => Promise<string>,
  fetchImpl: typeof fetch = fetch
): KakaoUnlinker {
  return {
    async unlink(kakaoUserId) {
      return unlinkKakaoUser(kakaoUserId, await loadAdminKey(), fetchImpl);
    },
  };
}

/** 한 번 읽은 Admin 키는 Lambda 인스턴스가 살아 있는 동안 기억한다. 실패는 기억하지 않는다. */
export function ssmAdminKeyLoader(ssm: SSMClient, name: string): () => Promise<string> {
  let cached: Promise<string> | null = null;
  return () => {
    cached ??= ssm
      .send(new GetParameterCommand({ Name: name, WithDecryption: true }))
      .then((out) => {
        const value = out.Parameter?.Value;
        if (!value) throw new Error("admin key missing");
        return value;
      })
      .catch((err: unknown) => {
        cached = null;
        throw err;
      });
    return cached;
  };
}
