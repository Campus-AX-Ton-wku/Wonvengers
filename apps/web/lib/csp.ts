/**
 * Content-Security-Policy (docs/기획/2026-11-04-카카오-로그인-설계.md '보안').
 *
 * refresh token 을 localStorage 에 두기로 했으니(정적 사이트라 HttpOnly 쿠키가 없다) XSS 가 곧 토큰
 * 탈취다. 정적 export 는 응답 헤더를 못 달아서 layout 의 <meta http-equiv> 로 단다.
 *
 * - connect-src: 이 사이트 + Cognito 도메인(토큰 교환·갱신) + API 출처뿐. 훔친 토큰을 다른 곳으로 보내지 못한다.
 * - script-src 'unsafe-inline': Next 가 페이지마다 인라인 스크립트(self.__next_f)를 넣어서 뺄 수 없다.
 *   우리가 더하는 인라인 스크립트는 layout 의 온보딩·첫 화면 기록 하나뿐이고 새로 늘리지 않는다.
 * - meta 로는 frame-ancestors 를 줄 수 없다(브라우저가 무시한다).
 */
export function contentSecurityPolicy(
  env: { NEXT_PUBLIC_COGNITO_DOMAIN?: string; NEXT_PUBLIC_API_URL?: string } = {
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  }
): string {
  const connect = ["'self'"];
  if (env.NEXT_PUBLIC_COGNITO_DOMAIN) connect.push(`https://${env.NEXT_PUBLIC_COGNITO_DOMAIN}`);
  if (env.NEXT_PUBLIC_API_URL) {
    try {
      connect.push(new URL(env.NEXT_PUBLIC_API_URL).origin);
    } catch {
      // 주소가 아니면 넣지 않는다 — 그러면 API 호출이 막혀 저장 실패로 보인다.
    }
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
