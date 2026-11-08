import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
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
