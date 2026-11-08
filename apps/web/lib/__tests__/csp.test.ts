import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/csp";

const directives = (csp: string) => csp.split("; ");

describe("contentSecurityPolicy", () => {
  it("환경변수가 없으면 connect-src 는 'self' 뿐", () => {
    const list = directives(contentSecurityPolicy({}));
    expect(list).toContain("connect-src 'self'");
    expect(list).toContain("default-src 'self'");
    expect(list).toContain("script-src 'self' 'unsafe-inline'");
    expect(list).toContain("object-src 'none'");
    expect(list).toContain("base-uri 'self'");
  });

  it("Cognito 도메인과 API 출처(경로 없이)만 더한다", () => {
    const csp = contentSecurityPolicy({
      NEXT_PUBLIC_COGNITO_DOMAIN: "perky-wonvengers.auth.ap-northeast-2.amazoncognito.com",
      NEXT_PUBLIC_API_URL: "https://abc123.execute-api.ap-northeast-2.amazonaws.com/",
    });
    expect(directives(csp)).toContain(
      "connect-src 'self' https://perky-wonvengers.auth.ap-northeast-2.amazoncognito.com https://abc123.execute-api.ap-northeast-2.amazonaws.com"
    );
  });

  it("주소가 아닌 API 값은 넣지 않는다", () => {
    expect(directives(contentSecurityPolicy({ NEXT_PUBLIC_API_URL: "not a url" }))).toContain("connect-src 'self'");
  });
});
