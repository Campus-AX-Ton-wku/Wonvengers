import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoAccounts, kakaoIdFromIdentities } from "../src/cognito";
import { A, B } from "./fixtures";

const cognito = mockClient(CognitoIdentityProviderClient);
const accounts = new CognitoAccounts(new CognitoIdentityProviderClient({ region: "ap-northeast-2" }), "pool-1");

const identities = JSON.stringify([
  { userId: "1001", providerName: "Kakao", providerType: "OIDC", issuer: null, primary: true, dateCreated: 1 },
]);

beforeEach(() => cognito.reset());

describe("CognitoAccounts", () => {
  it("AdminGetUser 의 identities 에서 카카오 회원번호를 읽는다", async () => {
    cognito.on(AdminGetUserCommand).resolves({
      Username: A.username,
      UserAttributes: [
        { Name: "sub", Value: A.sub },
        { Name: "identities", Value: identities },
      ],
    });
    expect(await accounts.kakaoUserId(A.username, A.sub)).toBe("1001");
    expect(cognito.commandCalls(AdminGetUserCommand)[0].args[0].input).toEqual({
      UserPoolId: "pool-1",
      Username: A.username,
    });
  });

  it("사용자 이름의 sub 가 토큰 sub 와 다르면 던진다", async () => {
    cognito.on(AdminGetUserCommand).resolves({
      UserAttributes: [
        { Name: "sub", Value: A.sub },
        { Name: "identities", Value: identities },
      ],
    });
    await expect(accounts.kakaoUserId(A.username, B.sub)).rejects.toThrow("token sub does not match");
  });

  it("카카오 연동이 없으면 던진다", () => {
    expect(() => kakaoIdFromIdentities(undefined)).toThrow("no Kakao identity");
    expect(() => kakaoIdFromIdentities('[{"providerName":"Google","userId":"9"}]')).toThrow("no Kakao identity");
  });

  it("deleteUser 는 그 풀의 그 사용자 이름만 지운다", async () => {
    cognito.on(AdminDeleteUserCommand).resolves({});
    await accounts.deleteUser(A.username);
    expect(cognito.commandCalls(AdminDeleteUserCommand)[0].args[0].input).toEqual({
      UserPoolId: "pool-1",
      Username: A.username,
    });
  });
});

/**
 * 카카오 연결 해제 웹훅(11/20) — 카카오가 알려 주는 건 회원번호뿐이라 거기서 Cognito 사용자를 찾는다.
 * 실제 사용자 이름은 `Kakao_<회원번호>`(대문자 K — 11/20 list-users 로 확인. 문서의 `kakao_…` 는 틀렸다).
 */
describe("CognitoAccounts.findByKakaoId", () => {
  it("Kakao_<회원번호> 로 찾고, identities 의 회원번호가 같으면 사용자 이름과 sub 를 돌려준다", async () => {
    cognito.on(AdminGetUserCommand).resolves({
      Username: "Kakao_1001",
      UserAttributes: [
        { Name: "sub", Value: A.sub },
        { Name: "identities", Value: identities },
      ],
    });
    expect(await accounts.findByKakaoId("1001")).toEqual({ username: "Kakao_1001", sub: A.sub });
    expect(cognito.commandCalls(AdminGetUserCommand)[0].args[0].input).toEqual({
      UserPoolId: "pool-1",
      Username: "Kakao_1001",
    });
  });

  it("그런 사용자가 없으면 null — 로그인만 하고 지운 사람, 이미 탈퇴한 사람", async () => {
    cognito.on(AdminGetUserCommand).rejects(new UserNotFoundException({ message: "User does not exist.", $metadata: {} }));
    expect(await accounts.findByKakaoId("1001")).toBeNull();
  });

  it("identities 의 회원번호가 다르면 null — 다른 사람을 지우지 않는다", async () => {
    cognito.on(AdminGetUserCommand).resolves({
      Username: "Kakao_2002",
      UserAttributes: [
        { Name: "sub", Value: B.sub },
        { Name: "identities", Value: identities },
      ],
    });
    expect(await accounts.findByKakaoId("2002")).toBeNull();
  });

  it("다른 오류는 그대로 던진다", async () => {
    cognito.on(AdminGetUserCommand).rejects(new Error("throttled"));
    await expect(accounts.findByKakaoId("1001")).rejects.toThrow("throttled");
  });
});
