import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/csp";

const directives = (csp: string) => csp.split("; ");

describe("contentSecurityPolicy", () => {
  it("환경변수가 없으면 connect-src 는 'self' 뿐", () => {
    const list = directives(contentSecurityPolicy({}));
    expect(list).toContain("connect-src 'self'");
    expect(list).toContain("default-src 'self'");
    expect(list).toContain("script-src 'self' 'unsafe-inline' dapi.kakao.com t1.daumcdn.net t1.kakaocdn.net");
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

  it("카카오 지도는 스크립트 · 이미지만 연다 — connect-src 에는 넣지 않는다 (11/22)", () => {
    const list = directives(contentSecurityPolicy({}));
    expect(list).toContain("img-src 'self' data: blob: *.daumcdn.net *.kakao.com *.kakaocdn.net");
    expect(list.find((d) => d.startsWith("connect-src"))).toBe("connect-src 'self'");
    for (const name of ["script-src", "img-src"]) {
      const sources = list.find((d) => d.startsWith(name))!.split(" ").slice(1);
      expect(sources.filter((src) => src.includes("://"))).toEqual([]);
    }
  });
});
